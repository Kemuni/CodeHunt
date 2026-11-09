"""Live Playwright с настоящим API в одноразовых PostgreSQL/MinIO/Redis Testcontainers.

Запуск из backend: uv run python scripts/test_live_e2e.py
Нужны Docker, frontend/node_modules и установленный браузер Playwright/Chrome.
Рабочие .env, БД и dev-серверы не используются.
"""

import asyncio
import json
import logging
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

import boto3
from testcontainers.community.postgres import PostgresContainer
from testcontainers.core.container import DockerContainer
from testcontainers.core.wait_strategies import HttpWaitStrategy

logger = logging.getLogger(__name__)
BACKEND = Path(__file__).resolve().parents[1]
FRONTEND = BACKEND.parent / "frontend"


async def serve_backend():
    # Импорты после настройки окружения дочернего процесса. cwd не содержит .env.
    import uvicorn

    from app.core.db import Base, async_session_maker, engine
    from app.main import app
    from app.models import AuthSession, User
    from app.services.auth import token_hash

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    try:
        async with async_session_maker() as session:
            for github_id, role in enumerate(("admin", "member"), start=1):
                email = f"{role}@example.test"
                user = User(
                    email=email,
                    github_id=github_id,
                    verified_emails=[email],
                    is_admin=role == "admin",
                )
                session.add(user)
                await session.flush()
                session.add(
                    AuthSession(
                        token_hash=token_hash(f"e2e-{role}"),
                        user_id=user.id,
                        expires_at=datetime.now(UTC) + timedelta(hours=1),
                    )
                )
            await session.commit()
        server = uvicorn.Server(
            uvicorn.Config(app, host="127.0.0.1", port=int(os.environ["E2E_API_PORT"]))
        )
        await server.serve()
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_ready(url, process):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Сервер завершился до готовности: {url}")
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except (URLError, TimeoutError):
            pass
        time.sleep(0.25)
    raise TimeoutError(f"Сервер не запустился: {url}")


@contextmanager
def running(command, cwd, env, log_path):
    with log_path.open("w") as log:
        process = subprocess.Popen(
            command, cwd=cwd, env=env, stdout=log, stderr=log, start_new_session=True
        )
        try:
            yield process
        finally:
            # Завершаем только собственную группу процессов, включая дочерний Next.js.
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def run():
    logs = Path(tempfile.mkdtemp(prefix="codehunt-live-e2e-results-"))
    logger.info("Логи и артефакты live E2E: %s", logs)
    minio = (
        DockerContainer("minio/minio")
        .with_env("MINIO_ROOT_USER", "codehunt_test")
        .with_env("MINIO_ROOT_PASSWORD", "codehunt_test_secret")
        .with_exposed_ports(9000)
        .with_command("server /data")
        .waiting_for(HttpWaitStrategy(9000, "/minio/health/ready"))
    )
    with (
        tempfile.TemporaryDirectory(prefix="codehunt-live-e2e-") as temporary,
        PostgresContainer("postgres:18-alpine", driver="asyncpg") as postgres,
        minio,
        DockerContainer("redis:7-alpine").with_exposed_ports(6379) as redis,
    ):
        root = Path(temporary)
        frontend = root / "frontend"
        shutil.copytree(
            FRONTEND,
            frontend,
            ignore=shutil.ignore_patterns(
                ".env*",
                "node_modules",
                ".next",
                "*.tsbuildinfo",
                "test-results",
                "playwright-report",
            ),
        )
        (frontend / "node_modules").symlink_to(
            FRONTEND / "node_modules", target_is_directory=True
        )
        backend_cwd = root / "backend"
        backend_cwd.mkdir()
        api_port, frontend_port = free_port(), free_port()
        endpoint = (
            f"http://{minio.get_container_host_ip()}:{minio.get_exposed_port(9000)}"
        )
        boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id="codehunt_test",
            aws_secret_access_key="codehunt_test_secret",
            region_name="us-east-1",
        ).create_bucket(Bucket="codehunt-live-tests")
        env = {
            **os.environ,
            "PYTHONPATH": str(BACKEND),
            "PROJECT_NAME": "CodeHunt live E2E",
            "DATABASE_URL": postgres.get_connection_url(),
            "S3_ENDPOINT_URL": endpoint,
            "S3_ACCESS_KEY": "codehunt_test",
            "S3_SECRET_KEY": "codehunt_test_secret",
            "S3_BUCKET": "codehunt-live-tests",
            "REDIS_URL": f"redis://{redis.get_container_host_ip()}:{redis.get_exposed_port(6379)}/0",
            "ADMIN_EMAILS": "admin@example.test",
            "GITHUB_ID": "e2e-client",
            "GITHUB_SECRET": "e2e-secret",
            "E2E_API_PORT": str(api_port),
            "BACKEND_API_URL": f"http://127.0.0.1:{api_port}",
            "NEXTAUTH_URL": f"http://localhost:{frontend_port}",
            "NEXTAUTH_SECRET": secrets.token_urlsafe(32),
            "E2E_LIVE_API": "1",
            "E2E_ISOLATED_AUTH": "0",
            "E2E_BASE_URL": f"http://localhost:{frontend_port}",
            "E2E_STORAGE_STATE": str(root / "storage-state.json"),
            "E2E_OUTPUT_DIR": str(logs / "playwright"),
        }
        env["E2E_AUTH_SECRET"] = env["NEXTAUTH_SECRET"]
        # Настоящая серверная сессия и зашифрованная cookie тестового администратора.
        # OAuth у GitHub проверяется отдельно; здесь нет обхода авторизации приложения.
        state = subprocess.check_output(
            [
                "node",
                "-e",
                """
const { encode } = require('next-auth/jwt');
encode({ secret: process.env.NEXTAUTH_SECRET, token: {
  name: 'GitHub Test User', picture: '/figma/our-logo.svg',
  backendToken: 'e2e-admin', backendExpiresAt: new Date(Date.now() + 3600000).toISOString()
}}).then(value => process.stdout.write(JSON.stringify({ cookies: [{
  name: 'next-auth.session-token', value, domain: 'localhost', path: '/',
  expires: -1, httpOnly: true, secure: false, sameSite: 'Lax'
}], origins: [] })));
""",
            ],
            cwd=frontend,
            env=env,
            text=True,
        )
        state_path = Path(env["E2E_STORAGE_STATE"])
        state_path.write_text(json.dumps(json.loads(state)))
        state_path.chmod(0o600)
        with running(
            [sys.executable, str(Path(__file__).resolve()), "--serve"],
            backend_cwd,
            env,
            logs / "backend.log",
        ) as backend_process:
            wait_ready(f"{env['BACKEND_API_URL']}/api/health-check/", backend_process)
            with running(
                ["npm", "run", "dev", "--", "--webpack", "--port", str(frontend_port)],
                frontend,
                env,
                logs / "frontend.log",
            ) as frontend_process:
                wait_ready(f"{env['E2E_BASE_URL']}/login", frontend_process)
                return subprocess.run(
                    ["npm", "run", "test:e2e", "--", "--grep", "@live"],
                    cwd=frontend,
                    env=env,
                ).returncode


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if sys.argv[1:] == ["--serve"]:
        asyncio.run(serve_backend())
    else:
        sys.exit(run())
