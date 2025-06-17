# backend/app/models/build_models.py - Build-related models

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class BuildRequest(BaseModel):
    environments: List[str]
    container_runtime: Optional[str] = "podman"


class BuildResponse(BaseModel):
    build_id: str
    status: str
    environments: List[str]
    message: str


class BuildStatus(BaseModel):
    build_id: str
    status: str  # "running", "completed", "failed", "cancelled"
    environments: List[str]
    start_time: datetime
    end_time: Optional[datetime] = None
    return_code: Optional[int] = None
    logs: List[str] = []
    successful_builds: List[str] = []
    failed_builds: List[str] = []


class BuildListItem(BaseModel):
    build_id: str
    status: str
    environments: List[str]
    start_time: datetime
    end_time: Optional[datetime] = None
    environment_count: int


class BuildList(BaseModel):
    builds: List[BuildListItem]


class ExportRequest(BaseModel):
    image_name: str = Field(..., description="Name of the built image to export")
    container_runtime: Optional[str] = "podman"


class ExportResponse(BaseModel):
    export_id: str
    status: str
    image_name: str
    message: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None


class ExportStatus(BaseModel):
    export_id: str
    status: str  # "running", "completed", "failed"
    image_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    return_code: Optional[int] = None
    logs: List[str] = []
    file_path: Optional[str] = None
    file_size: Optional[int] = None


class RegistryCredentials(BaseModel):
    username: str = Field(..., description="Registry username")
    password: str = Field(..., description="Registry password/token")


class PushRequest(BaseModel):
    image_name: str = Field(..., description="Local image name to push")
    registry_url: str = Field(default="quay.io", description="Registry URL")
    repository: str = Field(..., description="Target repository (e.g., username/repo-name)")
    tag: Optional[str] = Field(default="latest", description="Image tag")
    credentials: RegistryCredentials
    container_runtime: Optional[str] = "podman"


class PushResponse(BaseModel):
    push_id: str
    status: str
    image_name: str
    target_url: str
    message: str


class PushStatus(BaseModel):
    push_id: str
    status: str  # "running", "completed", "failed"
    image_name: str
    target_url: str
    start_time: datetime
    end_time: Optional[datetime] = None
    return_code: Optional[int] = None
    logs: List[str] = []


# Model for built images (leverages your existing container_utils)
class BuiltImage(BaseModel):
    name: str
    tag: str
    image_id: str
    created: str
    size: str


class BuiltImagesList(BaseModel):
    images: List[BuiltImage]
