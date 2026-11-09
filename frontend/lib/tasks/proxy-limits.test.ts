import assert from "node:assert/strict"
import { test } from "node:test"
import { proxyBackend } from "../backend-proxy"
import { JSON_BODY_LIMIT } from "../request-limits"
import "../../tests/proxy-session"

const path = ["contact-request", "candidate"]
const url = "http://localhost/api/backend/contact-request/candidate"

test("proxy rejects oversized Content-Length before forwarding the request", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}))
  const response = await proxyBackend(
    new Request(url, {
      method: "POST",
      headers: { origin: "http://localhost", "content-length": String(JSON_BODY_LIMIT + 1) },
      body: "{}",
    }),
    path,
  )
  assert.equal(response.status, 413)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(fetch.mock.callCount(), 0)
})

test("proxy streams bodies and enforces actual bytes without trusting Content-Length", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit & { duplex: string }) => {
    assert.ok(init.body instanceof ReadableStream)
    assert.equal(init.duplex, "half")
    const body = await new Response(init.body).text()
    return Response.json({ body })
  })
  const ok = await proxyBackend(
    new Request(url, { method: "POST", headers: { origin: "http://localhost" }, body: "hello" }),
    path,
  )
  assert.deepEqual(await ok.json(), { body: "hello" })
  for (const length of [null, "2"]) {
    let sent = false
    const body = new ReadableStream({
      pull(controller) {
        if (sent) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        } else {
          sent = true
          controller.enqueue(new Uint8Array(JSON_BODY_LIMIT))
        }
      },
    })
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      body,
      duplex: "half",
      headers: { origin: "http://localhost", ...(length ? { "content-length": length } : {}) },
    }
    const response = await proxyBackend(new Request(url, init), path)
    assert.equal(response.status, 413)
  }
})

test("proxy bounds backend wait time and returns an uncached timeout", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1000)
      const abort = () => {
        clearTimeout(timer)
        reject(init.signal?.reason)
      }
      if (init.signal?.aborted) abort()
      else init.signal?.addEventListener("abort", abort, { once: true })
    })
    return Response.json({})
  })
  const response = await proxyBackend(new Request(url), path, 10)
  assert.equal(response.status, 504)
  assert.equal(response.headers.get("cache-control"), "no-store")
})
