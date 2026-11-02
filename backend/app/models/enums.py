from enum import StrEnum


class DeveloperType(StrEnum):
    FRONTEND = "frontend"
    FULLSTACK = "fullstack"


class ComplicationGroup(StrEnum):
    # Функциональность: поиск, пагинация, избранное, личный кабинет.
    FUNCTIONALITY = "functionality"
    # Интерфейс: адаптивная вёрстка, тёмная тема, анимации, состояния загрузки.
    INTERFACE = "interface"
    # Качество: тесты, линтеры, доступность, обработка ошибок.
    QUALITY = "quality"
    # Безопасность: проверка прав, защита от XSS, ограничения частоты запросов.
    SECURITY = "security"
    # Инфраструктура: Docker, CI/CD, мониторинг, хранение файлов в S3.
    INFRASTRUCTURE = "infrastructure"
    # Архитектура: разделение модулей, очередь задач, кеширование, события.
    ARCHITECTURE = "architecture"


class Level(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HIGH = "high"


LEVELS = (Level.EASY, Level.MEDIUM, Level.HIGH)


class TaskStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ResourceType(StrEnum):
    DESIGN = "design"
    SPECIFICATION = "specification"
    ASSET = "asset"
    OTHER = "other"
