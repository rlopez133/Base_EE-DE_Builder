# backend/app/routers/builds.py - Build management endpoints

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List
from app.models.build_models import (
    # Existing models
    BuildRequest, BuildResponse, BuildStatus, BuildListItem,
    # New models for export/push
    ExportRequest, ExportResponse, ExportStatus, BuiltImagesList,
    PushRequest, PushResponse, PushStatus
)
from app.services.build_service import build_service

# Import new services (we'll create these)
from app.services.export_service import export_service
from app.services.registry_service import registry_service

router = APIRouter()

@router.post("/start", response_model=BuildResponse)
async def start_build(build_request: BuildRequest):
    """Start building selected environments"""
    try:
        return await build_service.start_build(build_request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start build: {str(e)}")


@router.get("/{build_id}/status", response_model=BuildStatus)
async def get_build_status(build_id: str):
    """Get build status, logs, and results"""
    try:
        return await build_service.get_build_status(build_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("", response_model=List[BuildListItem])
async def list_builds():
    """List all builds (running and completed)"""
    return build_service.list_builds()


@router.delete("/{build_id}")
async def cancel_build(build_id: str):
    """Cancel a running build"""
    try:
        return await build_service.cancel_build(build_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images", response_model=BuiltImagesList)
async def list_built_images(container_runtime: str = None):
    """List all locally built images available for export"""
    try:
        return await export_service.list_built_images(container_runtime)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list images: {str(e)}")


@router.post("/export", response_model=ExportResponse)
async def export_image(export_request: ExportRequest):
    """Start exporting a built image as .tar file"""
    try:
        return await export_service.start_export(export_request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start export: {str(e)}")


@router.get("/export/{export_id}/status", response_model=ExportStatus)
async def get_export_status(export_id: str):
    """Get export status and details"""
    try:
        return await export_service.get_export_status(export_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/export/{export_id}/download")
async def download_exported_image(export_id: str):
    """Download the exported .tar file"""
    try:
        file_path = export_service.get_export_file_path(export_id)
        
        # Get export info for filename
        export_status = await export_service.get_export_status(export_id)
        safe_image_name = export_status.image_name.replace("/", "_").replace(":", "_")
        filename = f"{safe_image_name}.tar"
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/x-tar",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")


@router.post("/push", response_model=PushResponse)
async def push_to_registry(push_request: PushRequest):
    """Push a built image to container registry (Quay.io)"""
    try:
        return await registry_service.start_push(push_request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start push: {str(e)}")


@router.get("/push/{push_id}/status", response_model=PushStatus)
async def get_push_status(push_id: str):
    """Get registry push status and details"""
    try:
        return await registry_service.get_push_status(push_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/validate-registry")
async def validate_registry_credentials(push_request: PushRequest):
    """Validate registry credentials without pushing"""
    try:
        # Use your existing registry validation from container_utils
        from app.utils.container_utils import get_container_registry_status
        
        # Test login with provided credentials
        await registry_service._login_to_registry(
            push_request.registry_url,
            push_request.credentials,
            push_request.container_runtime or "podman"
        )
        
        return {"valid": True, "message": "Registry credentials are valid"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid credentials: {str(e)}")
