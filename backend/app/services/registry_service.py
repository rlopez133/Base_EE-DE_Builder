# backend/app/services/registry_service.py - Registry service using existing utilities

import asyncio
import uuid
from datetime import datetime
from typing import Dict

from app.models.build_models import PushRequest, PushResponse, PushStatus
from app.core.config import settings

from app.utils.container_utils import validate_container_runtime, get_container_registry_status


class RegistryService:
    """Service for pushing to registries using your existing utilities"""
    
    def __init__(self):
        self.pushes: Dict[str, dict] = {}
    
    async def start_push(self, push_request: PushRequest) -> PushResponse:
        """Start pushing an image to registry"""
        image_name = push_request.image_name
        registry_url = push_request.registry_url
        repository = push_request.repository
        tag = push_request.tag or "latest"
        credentials = push_request.credentials
        container_runtime = push_request.container_runtime or settings.CONTAINER_RUNTIME
        
        # Use your existing validation
        await validate_container_runtime()
        
        # Check if image exists locally
        if not await self._image_exists(image_name, container_runtime):
            raise ValueError(f"Image '{image_name}' not found locally")
        
        # Build target URL
        target_url = f"{registry_url}/{repository}:{tag}"
        
        # Generate push ID
        push_id = str(uuid.uuid4())
        
        # Tag the image for target registry
        tagged_image = f"{registry_url}/{repository}:{tag}"
        
        try:
            # Step 1: Tag the image
            tag_cmd = [container_runtime, "tag", image_name, tagged_image]
            tag_process = await asyncio.create_subprocess_exec(
                *tag_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            tag_stdout, tag_stderr = await tag_process.communicate()
            
            if tag_process.returncode != 0:
                raise RuntimeError(f"Failed to tag image: {tag_stderr.decode()}")
            
            # Step 2: Login to registry (simple approach)
            await self._login_to_registry(registry_url, credentials, container_runtime)
            
            # Step 3: Start push
            push_cmd = [container_runtime, "push", tagged_image]
            process = await asyncio.create_subprocess_exec(
                *push_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            
            # Store push info
            self.pushes[push_id] = {
                "process": process,
                "image_name": image_name,
                "target_url": target_url,
                "tagged_image": tagged_image,
                "container_runtime": container_runtime,
                "status": "running",
                "start_time": datetime.now(),
                "end_time": None,
                "return_code": None,
                "logs": [
                    f"🚀 Push started at {datetime.now().strftime('%H:%M:%S')}",
                    f"📦 Pushing image: {image_name}",
                    f"🎯 Target: {target_url}",
                    f"✅ Image tagged as: {tagged_image}",
                    f"🔐 Logged into registry: {registry_url}",
                    "⏳ Starting push process..."
                ]
            }
            
            # Monitor in background
            asyncio.create_task(self._monitor_push(push_id))
            
            return PushResponse(
                push_id=push_id,
                status="started",
                image_name=image_name,
                target_url=target_url,
                message=f"Started pushing image '{image_name}' to {target_url}"
            )
            
        except Exception as e:
            # Cleanup tagged image if push fails
            try:
                cleanup_cmd = [container_runtime, "rmi", tagged_image]
                cleanup_process = await asyncio.create_subprocess_exec(
                    *cleanup_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await cleanup_process.communicate()
            except:
                pass  # Ignore cleanup errors
            
            raise e
    
    async def get_push_status(self, push_id: str) -> PushStatus:
        """Get push status"""
        if push_id not in self.pushes:
            raise ValueError(f"Push {push_id} not found")
        
        push_info = self.pushes[push_id]
        process = push_info.get("process")
        
        # Simple status check
        if process and process.returncode is None:
            status = "running"
            end_time = None
        else:
            status = "completed" if push_info.get("return_code") == 0 else "failed"
            end_time = push_info.get("end_time")
        
        return PushStatus(
            push_id=push_id,
            status=status,
            image_name=push_info["image_name"],
            target_url=push_info["target_url"],
            start_time=push_info["start_time"],
            end_time=end_time,
            return_code=push_info.get("return_code"),
            logs=push_info.get("logs", [])
        )
    
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
    
    async def _login_to_registry(self, registry_url: str, credentials, container_runtime: str):
        """Login to registry using credentials"""
        # Simple login with password via stdin
        login_cmd = [container_runtime, "login", registry_url, "--username", credentials.username, "--password-stdin"]
        
        process = await asyncio.create_subprocess_exec(
            *login_cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate(input=credentials.password.encode())
        
        if process.returncode != 0:
            raise RuntimeError(f"Failed to login to registry {registry_url}: {stderr.decode()}")
    
    async def _monitor_push(self, push_id: str):
        """Simple background monitoring"""
        if push_id not in self.pushes:
            return
        
        push_info = self.pushes[push_id]
        process = push_info["process"]
        
        try:
            # Read output for logs
            while True:
                try:
                    line = await asyncio.wait_for(process.stdout.readline(), timeout=1.0)
                except asyncio.TimeoutError:
                    if process.returncode is not None:
                        break
                    continue
                
                if not line:
                    break
                
                line_text = line.decode('utf-8').strip()
                if line_text:
                    push_info["logs"].append(line_text)
            
            # Wait for completion
            await process.wait()
            
            # Update final status
            push_info["return_code"] = process.returncode
            push_info["end_time"] = datetime.now()
            
            if process.returncode == 0:
                push_info["status"] = "completed"
                push_info["logs"].append("✅ Push completed successfully")
                push_info["logs"].append(f"🎯 Image available at: {push_info['target_url']}")
            else:
                push_info["status"] = "failed"
                push_info["logs"].append("❌ Push failed")
            
            # Cleanup tagged image
            try:
                tagged_image = push_info.get("tagged_image")
                if tagged_image:
                    cleanup_cmd = [push_info["container_runtime"], "rmi", tagged_image]
                    cleanup_process = await asyncio.create_subprocess_exec(
                        *cleanup_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    await cleanup_process.communicate()
                    push_info["logs"].append("🧹 Cleaned up tagged image")
            except Exception as e:
                push_info["logs"].append(f"⚠️ Failed to cleanup: {e}")
            
        except Exception as e:
            push_info["logs"].append(f"Error: {str(e)}")
            push_info["status"] = "failed"
            push_info["return_code"] = -1
            push_info["end_time"] = datetime.now()


# Global service instance
registry_service = RegistryService()
