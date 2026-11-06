from enum import StrEnum


class DeveloperType(StrEnum):
    FRONTEND = "frontend"
    FULLSTACK = "fullstack"


class Level(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HIGH = "high"


LEVELS = (Level.EASY, Level.MEDIUM, Level.HIGH)


class TaskStatus(StrEnum):
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ResourceType(StrEnum):
    DESIGN = "design"
    SPECIFICATION = "specification"
    ASSET = "asset"
    OTHER = "other"
