# backend/app/services/export_service.py - Fixed JSON parsing

import asyncio
import uuid
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from app.models.build_models import ExportRequest, ExportResponse, ExportStatus, BuiltImage, BuiltImagesList
from app.core.config import settings
from app.utils.container_utils import list_container_images, validate_container_runtime
from app.utils.file_utils import ensure_directory_exists, cleanup_temp_file


class ExportService:
    """Service for exporting container images using existing utilities"""
    
    def __init__(self):
        self.exports: Dict[str, dict] = {}
        self.exports_dir = ensure_directory_exists("/tmp/ee_exports")
    
    async def list_built_images(self, container_runtime: str = None) -> BuiltImagesList:
        """List built images - fixed JSON parsing"""
        await validate_container_runtime()
        
        try:
            runtime = container_runtime or settings.CONTAINER_RUNTIME
            cmd = [runtime, "images", "--format", "json"]
            
            print(f"🔍 Running command: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                print(f"❌ Command failed: {stderr.decode()}")
                return BuiltImagesList(images=[])
            
            raw_output = stdout.decode().strip()
            
            if not raw_output:
                print("❌ No output from images command")
                return BuiltImagesList(images=[])
            
            # Parse the entire JSON array at once
            try:
                images_data = json.loads(raw_output)
                print(f"✅ Parsed JSON successfully, found {len(images_data)} images")
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON: {e}")
                print(f"❌ Raw output sample: {raw_output[:200]}...")
                return BuiltImagesList(images=[])
            
            images = []
            
            for i, image_data in enumerate(images_data):
                try:
                    if not isinstance(image_data, dict):
                        print(f"⚠️ Image {i+1} is not a dict: {type(image_data)}")
                        continue
                    
                    # Get names - try different field names
                    names = (image_data.get("Names") or 
                            image_data.get("RepoTags") or [])
                    
                    if not names:
                        print(f"⚠️ Image {i+1} has no names")
                        continue
                    
                    # Ensure names is a list
                    if isinstance(names, str):
                        names = [names]
                    
                    # Filter out registry images and <none> tags
                    valid_names = []
                    for name in names:
                        if (name and 
                            not name.startswith("<none>") and 
                            name != "<none>:<none>" and
                            "registry.redhat.io" not in name):
                            valid_names.append(name)
                    
                    if valid_names:
                        name = valid_names[0]
                        
                        # Extract tag from name if present
                        if ':' in name:
                            name_part, tag_part = name.rsplit(':', 1)
                            tag = tag_part
                        else:
                            name_part = name
                            tag = "latest"
                        
                        # Get other fields
                        image_id = (image_data.get("Id") or 
                                  image_data.get("ID") or 
                                  image_data.get("ImageId") or "unknown")
                        if len(image_id) > 12:
                            image_id = image_id[:12]
                        
                        created = str(image_data.get("Created") or 
                                    image_data.get("CreatedAt") or "unknown")
                        size = str(image_data.get("Size") or 
                                 image_data.get("VirtualSize") or "unknown")
                        
                        built_image = BuiltImage(
                            name=name,
                            tag=tag,
                            image_id=image_id,
                            created=created,
                            size=size
                        )
                        
                        images.append(built_image)
                        print(f"✅ Added image: {name}:{tag}")
                        
                except Exception as e:
                    print(f"❌ Error processing image {i+1}: {e}")
                    continue
            
            print(f"🎯 Final result: Found {len(images)} usable images")
            return BuiltImagesList(images=images)
            
        except Exception as e:
            print(f"❌ Critical error in list_built_images: {e}")
            import traceback
            traceback.print_exc()
            return BuiltImagesList(images=[])
    
    async def start_export(self, export_request: ExportRequest) -> ExportResponse:
        """Start exporting an image using podman/docker save"""
        image_name = export_request.image_name
        container_runtime = export_request.container_runtime or settings.CONTAINER_RUNTIME
        
        await validate_container_runtime()
        
        if not await self._image_exists(image_name, container_runtime):
            raise ValueError(f"Image '{image_name}' not found locally")
        
        export_id = str(uuid.uuid4())
        safe_image_name = image_name.replace("/", "_").replace(":", "_")
        export_filename = f"{safe_image_name}_{export_id[:8]}.tar"
        export_path = self.exports_dir / export_filename
        
        cmd = [container_runtime, "save", "-o", str(export_path), image_name]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT
        )
        
        self.exports[export_id] = {
            "process": process,
            "image_name": image_name,
            "status": "running",
            "start_time": datetime.now(),
            "end_time": None,
            "return_code": None,
            "logs": [
                f"🚀 Export started at {datetime.now().strftime('%H:%M:%S')}",
                f"📦 Exporting image: {image_name}",
                f"📁 Export file: {export_filename}",
                "⏳ Running export command..."
            ],
            "file_path": str(export_path),
            "file_size": None
        }
        
        asyncio.create_task(self._monitor_export(export_id))
        
        return ExportResponse(
            export_id=export_id,
            status="started",
            image_name=image_name,
            message=f"Started exporting image '{image_name}' to .tar file"
        )
    
    async def get_export_status(self, export_id: str) -> ExportStatus:
        """Get export status"""
        if export_id not in self.exports:
            raise ValueError(f"Export {export_id} not found")
        
        export_info = self.exports[export_id]
        process = export_info.get("process")
        
        if process and process.returncode is None:
            status = "running"
            end_time = None
        else:
            status = "completed" if export_info.get("return_code") == 0 else "failed"
            end_time = export_info.get("end_time")
        
        return ExportStatus(
            export_id=export_id,
            status=status,
            image_name=export_info["image_name"],
            start_time=export_info["start_time"],
            end_time=end_time,
            return_code=export_info.get("return_code"),
            logs=export_info.get("logs", []),
            file_path=export_info.get("file_path"),
            file_size=export_info.get("file_size")
        )
    
    def get_export_file_path(self, export_id: str) -> str:
        """Get file path for download"""
        if export_id not in self.exports:
            raise ValueError(f"Export {export_id} not found")
        
        export_info = self.exports[export_id]
        if export_info.get("status") != "completed":
            raise ValueError(f"Export {export_id} is not completed")
        
        file_path = export_info.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise ValueError(f"Export file not found for {export_id}")
        
        return file_path
    
    async def _image_exists(self, image_name: str, container_runtime: str) -> bool:
        """Check if image exists locally"""
        try:
            cmd = [container_runtime, "inspect", image_name]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            return process.returncode == 0
        except Exception:
            return False
    
    async def _monitor_export(self, export_id: str):
        """Background monitoring for export process"""
        if export_id not in self.exports:
            return
        
        export_info = self.exports[export_id]
        process = export_info["process"]
        
        try:
            await process.wait()
            
            export_info["return_code"] = process.returncode
            export_info["end_time"] = datetime.now()
            
            if process.returncode == 0:
                export_info["status"] = "completed"
                export_info["logs"].append("✅ Export completed successfully")
                
                file_path = export_info.get("file_path")
                if file_path and os.path.exists(file_path):
                    export_info["file_size"] = os.path.getsize(file_path)
            else:
                export_info["status"] = "failed"
                export_info["logs"].append("❌ Export failed")
                
                file_path = export_info.get("file_path")
                if file_path:
                    cleanup_temp_file(file_path)
            
        except Exception as e:
            export_info["status"] = "failed"
            export_info["logs"].append(f"Error: {str(e)}")
            export_info["return_code"] = -1
            export_info["end_time"] = datetime.now()


# Global service instance
export_service = ExportService()
