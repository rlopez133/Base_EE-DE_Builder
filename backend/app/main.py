# backend/main.py - Complete Enhanced Backend with Red Hat Authentication and Custom EE Wizard

import asyncio
import uuid
import json
import os
import tempfile
import yaml
import time
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="EE-DE Builder API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enhanced storage for builds - keeps completed builds for 1 hour
running_builds: Dict[str, dict] = {}
completed_builds: Dict[str, dict] = {}

# Pydantic models
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
    status: str  # "running", "completed", "failed"
    environments: List[str]
    start_time: datetime
    end_time: Optional[datetime] = None
    return_code: Optional[int] = None
    logs: List[str] = []
    successful_builds: List[str] = []
    failed_builds: List[str] = []

class RHAuthRequest(BaseModel):
    username: str
    password: str

class RHAuthResponse(BaseModel):
    success: bool
    message: str

# Updated Custom EE Wizard Models with YAML import support
class CustomEERequest(BaseModel):
    name: str
    description: Optional[str] = ""
    base_image: Optional[str] = ""
    python_packages: List[str] = []
    system_packages: List[str] = []
    ansible_collections: List[str] = []
    additional_build_steps: Optional[str] = None
    build_immediately: Optional[bool] = False
    # New fields for YAML import mode
    import_mode: Optional[str] = "wizard"  # "wizard" or "yaml"
    yaml_content: Optional[str] = ""

class CustomEEResponse(BaseModel):
    success: bool
    message: str
    environment_path: Optional[str] = None
    build_id: Optional[str] = None

# Available base images
AVAILABLE_BASE_IMAGES = {
    "ee-minimal-rhel9": {
        "name": "registry.redhat.io/ansible-automation-platform-25/ee-minimal-rhel9:latest",
        "description": "Minimal RHEL 9 Execution Environment - lightweight base",
        "type": "EE",
        "os": "RHEL 9"
    },
    "ee-supported-rhel9": {
        "name": "registry.redhat.io/ansible-automation-platform-25/ee-supported-rhel9:latest", 
        "description": "Supported RHEL 9 Execution Environment - includes common collections",
        "type": "EE",
        "os": "RHEL 9"
    },
    "de-supported-rhel9": {
        "name": "registry.redhat.io/ansible-automation-platform-25/de-supported-rhel9:latest",
        "description": "Development Environment RHEL 9 - includes development tools",
        "type": "DE", 
        "os": "RHEL 9"
    },
    "ee-minimal-rhel8": {
        "name": "registry.redhat.io/ansible-automation-platform-25/ee-minimal-rhel8:latest",
        "description": "Minimal RHEL 8 Execution Environment",
        "type": "EE",
        "os": "RHEL 8"
    },
    "ee-supported-rhel8": {
        "name": "registry.redhat.io/ansible-automation-platform-25/ee-supported-rhel8:latest",
        "description": "Supported RHEL 8 Execution Environment",
        "type": "EE", 
        "os": "RHEL 8"
    }
}

def cleanup_old_builds():
    """Remove completed builds older than 1 hour"""
    cutoff_time = datetime.now() - timedelta(hours=1)
    
    builds_to_remove = []
    for build_id, build_info in completed_builds.items():
        if build_info.get("end_time") and build_info["end_time"] < cutoff_time:
            builds_to_remove.append(build_id)
    
    for build_id in builds_to_remove:
        print(f"Cleaning up old build: {build_id}")
        del completed_builds[build_id]

def get_build_info(build_id: str) -> Optional[dict]:
    """Get build info from either running or completed builds"""
    # Check running builds first
    if build_id in running_builds:
        return running_builds[build_id]
    
    # Check completed builds
    if build_id in completed_builds:
        return completed_builds[build_id]
    
    return None

def move_to_completed(build_id: str):
    """Move a build from running to completed storage"""
    if build_id in running_builds:
        build_info = running_builds[build_id]
        build_info["end_time"] = datetime.now()
        completed_builds[build_id] = build_info
        del running_builds[build_id]
        print(f"DEBUG: Successfully moved build {build_id} to completed builds")
        print(f"DEBUG: Running builds count: {len(running_builds)}")
        print(f"DEBUG: Completed builds count: {len(completed_builds)}")
    else:
        print(f"WARNING: Attempted to move non-existent build {build_id}")

def analyze_environment_health(env_dir: Path) -> dict:
    """Analyze an environment for build readiness and issues"""
    issues = []
    severity = "low"
    ready = True
    
    env_name = env_dir.name
    ee_file = env_dir / "execution-environment.yml"
    
    # Check if execution-environment.yml exists
    if not ee_file.exists():
        issues.append("Missing execution-environment.yml")
        severity = "high"
        ready = False
        return {"ready": ready, "issues": issues, "severity": severity}
    
    try:
        # Parse execution-environment.yml
        with open(ee_file, 'r') as f:
            ee_config = yaml.safe_load(f)
        
        if not ee_config:
            issues.append("Empty execution-environment.yml")
            severity = "high"
            ready = False
            return {"ready": ready, "issues": issues, "severity": severity}
        
        # Check for required fields
        if "version" not in ee_config:
            issues.append("Missing version field")
            severity = "medium"
        
        # Check for base image
        if "images" not in ee_config and "image" not in ee_config:
            issues.append("No base image specified")
            severity = "high"
            ready = False
        
        # Check dependency files if referenced
        dependencies = ee_config.get("dependencies", {})
        
        # Check Python requirements
        if "python" in dependencies:
            python_reqs = dependencies["python"]
            if isinstance(python_reqs, str) or (isinstance(python_reqs, dict) and "requirements" in python_reqs):
                req_file = python_reqs if isinstance(python_reqs, str) else python_reqs["requirements"]
                req_path = env_dir / req_file
                if not req_path.exists():
                    issues.append(f"Missing {req_file}")
                    severity = "medium"
        
        # Check Ansible requirements
        if "galaxy" in dependencies:
            galaxy_reqs = dependencies["galaxy"]
            if isinstance(galaxy_reqs, str) or (isinstance(galaxy_reqs, dict) and "requirements" in galaxy_reqs):
                req_file = galaxy_reqs if isinstance(galaxy_reqs, str) else galaxy_reqs["requirements"]
                req_path = env_dir / req_file
                if not req_path.exists():
                    issues.append(f"Missing {req_file}")
                    severity = "medium"
        
        # Check system packages
        if "system" in dependencies:
            system_reqs = dependencies["system"]
            if isinstance(system_reqs, str) or (isinstance(system_reqs, dict) and "bindep" in system_reqs):
                req_file = system_reqs if isinstance(system_reqs, str) else system_reqs["bindep"]
                req_path = env_dir / req_file
                if not req_path.exists():
                    issues.append(f"Missing {req_file}")
                    severity = "medium"
        
        # Check for common issues
        if ee_config.get("version") == 1:
            # Version 1 format checks
            pass
        elif ee_config.get("version") == 2:
            # Version 2 format checks
            pass
        else:
            issues.append("Unsupported or missing version")
            severity = "medium"
        
    except yaml.YAMLError as e:
        issues.append(f"Invalid YAML syntax: {str(e)[:50]}...")
        severity = "high"
        ready = False
    except Exception as e:
        issues.append(f"Parse error: {str(e)[:50]}...")
        severity = "high"
        ready = False
    
    # If we have medium/high severity issues, not ready
    if severity in ["medium", "high"]:
        ready = False
    
    return {"ready": ready, "issues": issues, "severity": severity}

def estimate_image_size(env_dir: Path) -> int:
    """Estimate container image size based on dependencies"""
    base_size = 200  # Base EE image ~200MB
    estimated_size = base_size
    
    ee_file = env_dir / "execution-environment.yml"
    if not ee_file.exists():
        return estimated_size
    
    try:
        with open(ee_file, 'r') as f:
            ee_config = yaml.safe_load(f)
        
        if not ee_config:
            return estimated_size
        
        dependencies = ee_config.get("dependencies", {})
        
        # Estimate based on Python packages
        python_deps = dependencies.get("python", {})
        if python_deps:
            req_file = None
            if isinstance(python_deps, str):
                req_file = env_dir / python_deps
            elif isinstance(python_deps, dict) and "requirements" in python_deps:
                req_file = env_dir / python_deps["requirements"]
            
            if req_file and req_file.exists():
                try:
                    with open(req_file, 'r') as f:
                        lines = f.readlines()
                    
                    # Rough estimation: 10MB per Python package
                    package_count = len([line for line in lines if line.strip() and not line.startswith('#')])
                    estimated_size += package_count * 10
                except:
                    pass
        
        # Estimate based on Ansible collections
        galaxy_deps = dependencies.get("galaxy", {})
        if galaxy_deps:
            req_file = None
            if isinstance(galaxy_deps, str):
                req_file = env_dir / galaxy_deps
            elif isinstance(galaxy_deps, dict) and "requirements" in galaxy_deps:
                req_file = env_dir / galaxy_deps["requirements"]
            
            if req_file and req_file.exists():
                try:
                    with open(req_file, 'r') as f:
                        galaxy_config = yaml.safe_load(f)
                    
                    if galaxy_config and "collections" in galaxy_config:
                        # Rough estimation: 15MB per collection
                        collection_count = len(galaxy_config["collections"])
                        estimated_size += collection_count * 15
                except:
                    pass
        
        # Estimate based on system packages
        system_deps = dependencies.get("system", {})
        if system_deps:
            req_file = None
            if isinstance(system_deps, str):
                req_file = env_dir / system_deps
            elif isinstance(system_deps, dict) and "bindep" in system_deps:
                req_file = env_dir / system_deps["bindep"]
            
            if req_file and req_file.exists():
                try:
                    with open(req_file, 'r') as f:
                        lines = f.readlines()
                    
                    # Rough estimation: 20MB per system package
                    package_count = len([line for line in lines if line.strip() and not line.startswith('#')])
                    estimated_size += package_count * 20
                except:
                    pass
        
    except Exception as e:
        print(f"Error estimating size for {env_dir.name}: {e}")
    
    return min(estimated_size, 2000)  # Cap at 2GB

def calculate_build_success_rate() -> dict:
    """Calculate build success rate from recent builds"""
    try:
        # Look at builds from last 30 days
        cutoff_date = datetime.now() - timedelta(days=30)
        
        total_builds = 0
        successful_builds = 0
        
        # Check completed builds
        for build_id, build_info in completed_builds.items():
            if build_info.get("start_time") and build_info["start_time"] > cutoff_date:
                total_builds += 1
                if build_info.get("return_code") == 0:
                    successful_builds += 1
        
        # Check running builds (count as in-progress)
        for build_id, build_info in running_builds.items():
            if build_info.get("start_time") and build_info["start_time"] > cutoff_date:
                total_builds += 1
                # Don't count as success yet since still running
        
        if total_builds == 0:
            percentage = 100  # No failures = 100%
        else:
            percentage = round((successful_builds / total_builds) * 100)
        
        return {
            "percentage": percentage,
            "successful_builds": successful_builds,
            "total_builds": total_builds,
            "period_days": 30
        }
        
    except Exception as e:
        print(f"Error calculating success rate: {e}")
        return {
            "percentage": 0,
            "successful_builds": 0,
            "total_builds": 0,
            "period_days": 30
        }

# RED HAT AUTHENTICATION ENDPOINTS
@app.post("/api/auth/redhat-login", response_model=RHAuthResponse)
async def redhat_registry_login(auth_request: RHAuthRequest):
    """Authenticate with Red Hat registry using podman login"""
    try:
        # Validate inputs (don't log the actual credentials!)
        if not auth_request.username or not auth_request.password:
            return RHAuthResponse(
                success=False,
                message="Username and password are required"
            )
        
        print(f"DEBUG: Attempting Red Hat registry login for user: {auth_request.username}")
        
        # Run podman login command
        cmd = [
            "podman", 
            "login", 
            "registry.redhat.io",
            "--username", auth_request.username,
            "--password-stdin"
        ]
        
        # Use subprocess with password via stdin for security
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Send password via stdin (more secure than command line args)
        stdout, stderr = process.communicate(input=auth_request.password)
        
        if process.returncode == 0:
            print(f"DEBUG: Successfully authenticated with Red Hat registry for user: {auth_request.username}")
            return RHAuthResponse(
                success=True,
                message="Successfully authenticated with Red Hat registry"
            )
        else:
            print(f"DEBUG: Failed to authenticate with Red Hat registry. Return code: {process.returncode}")
            # Don't include the full error in response as it might contain sensitive info
            error_msg = "Authentication failed. Please check your credentials."
            if "unauthorized" in stderr.lower():
                error_msg = "Invalid username or password"
            elif "network" in stderr.lower() or "connection" in stderr.lower():
                error_msg = "Network error - please check your internet connection"
            
            return RHAuthResponse(
                success=False,
                message=error_msg
            )
            
    except FileNotFoundError:
        return RHAuthResponse(
            success=False,
            message="Podman not found. Please install podman."
        )
    except Exception as e:
        print(f"ERROR: Red Hat authentication error: {str(e)}")
        return RHAuthResponse(
            success=False,
            message="Authentication failed due to system error"
        )

@app.get("/api/auth/redhat-status")
async def redhat_registry_status():
    """Check if already authenticated with Red Hat registry"""
    try:
        # Try to get auth info from podman
        result = subprocess.run(
            ["podman", "login", "--get-login", "registry.redhat.io"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0 and result.stdout.strip():
            return {
                "authenticated": True,
                "username": result.stdout.strip(),
                "message": "Already authenticated with Red Hat registry"
            }
        else:
            return {
                "authenticated": False,
                "username": None,
                "message": "Not authenticated with Red Hat registry"
            }
            
    except subprocess.TimeoutExpired:
        return {
            "authenticated": False,
            "username": None,
            "message": "Timeout checking authentication status"
        }
    except FileNotFoundError:
        return {
            "authenticated": False,
            "username": None,
            "message": "Podman not found"
        }
    except Exception as e:
        print(f"ERROR: Checking RH auth status: {e}")
        return {
            "authenticated": False,
            "username": None,
            "message": "Error checking authentication status"
        }

@app.post("/api/auth/redhat-logout")
async def redhat_registry_logout():
    """Logout from Red Hat registry"""
    try:
        result = subprocess.run(
            ["podman", "logout", "registry.redhat.io"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        return {
            "success": result.returncode == 0,
            "message": "Logged out from Red Hat registry" if result.returncode == 0 else "Logout failed"
        }
        
    except Exception as e:
        print(f"ERROR: RH logout error: {e}")
        return {
            "success": False,
            "message": "Logout failed due to system error"
        }

# CUSTOM EE WIZARD ENDPOINTS
@app.get("/api/custom-ee/base-images")
async def get_available_base_images():
    """Get list of available base images for custom EE creation"""
    return {"base_images": AVAILABLE_BASE_IMAGES}

@app.post("/api/custom-ee/create", response_model=CustomEEResponse)
async def create_custom_ee(custom_ee: CustomEERequest):
    """Create a custom execution environment with wizard inputs or YAML import"""
    try:
        # Validate name
        if not custom_ee.name or not custom_ee.name.replace('-', '').replace('_', '').isalnum():
            return CustomEEResponse(
                success=False,
                message="Environment name must contain only letters, numbers, hyphens, and underscores"
            )
        
        # Check if environment already exists
        environments_dir = Path("environments")
        env_path = environments_dir / custom_ee.name
        
        if env_path.exists():
            return CustomEEResponse(
                success=False,
                message=f"Environment '{custom_ee.name}' already exists"
            )
        
        # Create environment directory
        env_path.mkdir(parents=True, exist_ok=True)

        # Handle YAML import mode vs wizard mode
        if custom_ee.import_mode == "yaml":
            print(f"DEBUG: Creating custom EE '{custom_ee.name}' using YAML import mode")
            
            # Validate YAML content
            if not custom_ee.yaml_content or not custom_ee.yaml_content.strip():
                return CustomEEResponse(
                    success=False,
                    message="YAML content is required for import mode"
                )
            
            # Validate YAML syntax
            try:
                yaml.safe_load(custom_ee.yaml_content)
            except yaml.YAMLError as e:
                return CustomEEResponse(
                    success=False,
                    message=f"Invalid YAML syntax: {str(e)}"
                )
            
            # Write the YAML content exactly as provided to execution-environment.yml
            with open(env_path / "execution-environment.yml", 'w') as f:
                f.write(custom_ee.yaml_content)
            
            # Create a simple README for YAML imports
            readme_content = f"""# {custom_ee.name}

**Created:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Import Mode:** YAML Import

## Description
This execution environment was created by importing an existing execution-environment.yml file.

## Build Command
```bash
ansible-builder build -t {custom_ee.name}:latest -f environments/{custom_ee.name}/execution-environment.yml
```

## Content
The execution-environment.yml file contains the exact YAML content that was imported.
"""
            
            with open(env_path / "README.md", 'w') as f:
                f.write(readme_content)
            
            print(f"DEBUG: YAML import completed for '{custom_ee.name}'")
            
        else:
            # Original wizard mode logic
            print(f"DEBUG: Creating custom EE '{custom_ee.name}' using wizard mode")
            
            # Generate execution-environment.yml
            execution_env_config = {
                "version": 3,
                "images": {
                    "base_image": {
                        "name": custom_ee.base_image,
                        "options": {
                            "pull_policy": "missing",
                            "tls_verify": False
                        }
                    }
                },
                "dependencies": {
                    "ansible_core": {
                        "package_pip": "ansible-core>=2.15,<2.17"
                    },
                    "ansible_runner": {
                        "package_pip": "ansible-runner>=2.0.0"
                    }
                },
                "options": {
                    "package_manager_path": "/usr/bin/microdnf"
                }
            }
            
            # Add file dependencies if we have packages/collections
            if custom_ee.python_packages:
                execution_env_config["dependencies"]["python"] = "requirements.txt"
            
            if custom_ee.system_packages:
                execution_env_config["dependencies"]["system"] = "bindep.txt"
                
            if custom_ee.ansible_collections:
                execution_env_config["dependencies"]["galaxy"] = "requirements.yml"
            
            # Add additional build steps if provided
            if custom_ee.additional_build_steps:
                execution_env_config["additional_build_steps"] = {
                    "append_final": custom_ee.additional_build_steps
                }
            
            # Write execution-environment.yml
            with open(env_path / "execution-environment.yml", 'w') as f:
                yaml.dump(execution_env_config, f, default_flow_style=False, sort_keys=False)
            
            # Generate requirements.txt (Python packages)
            if custom_ee.python_packages:
                with open(env_path / "requirements.txt", 'w') as f:
                    for package in custom_ee.python_packages:
                        f.write(f"{package.strip()}\n")
            
            # Generate bindep.txt (System packages)
            if custom_ee.system_packages:
                with open(env_path / "bindep.txt", 'w') as f:
                    for package in custom_ee.system_packages:
                        f.write(f"{package.strip()} [platform:rpm]\n")
            
            # Generate requirements.yml (Ansible collections)
            if custom_ee.ansible_collections:
                collections_config = {
                    "collections": []
                }
                for collection in custom_ee.ansible_collections:
                    if ':' in collection:  # Handle version specification like "community.general:>=1.0.0"
                        name, version = collection.split(':', 1)
                        collections_config["collections"].append({
                            "name": name.strip(),
                            "version": version.strip()
                        })
                    else:
                        collections_config["collections"].append({
                            "name": collection.strip()
                        })
                
                with open(env_path / "requirements.yml", 'w') as f:
                    yaml.dump(collections_config, f, default_flow_style=False, sort_keys=False)
            
            # Create a README for the custom environment
            readme_content = f"""# {custom_ee.name}

**Description:** {custom_ee.description}

**Base Image:** {custom_ee.base_image}

**Created:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Components

### Python Packages
{chr(10).join(f"- {pkg}" for pkg in custom_ee.python_packages) if custom_ee.python_packages else "None"}

### System Packages  
{chr(10).join(f"- {pkg}" for pkg in custom_ee.system_packages) if custom_ee.system_packages else "None"}

### Ansible Collections
{chr(10).join(f"- {col}" for col in custom_ee.ansible_collections) if custom_ee.ansible_collections else "None"}

## Build Command
```bash
ansible-builder build -t {custom_ee.name}:latest -f environments/{custom_ee.name}/execution-environment.yml
```
"""
            
            with open(env_path / "README.md", 'w') as f:
                f.write(readme_content)
        
        print(f"DEBUG: Created custom environment: {custom_ee.name} at {env_path}")
        
        # Optionally start build immediately
        build_id = None
        if custom_ee.build_immediately:
            try:
                # Use existing build logic
                build_request = BuildRequest(
                    environments=[custom_ee.name],
                    container_runtime="podman"
                )
                build_response = await start_build(build_request)
                build_id = build_response.build_id
                print(f"DEBUG: Started immediate build for {custom_ee.name}: {build_id}")
            except Exception as e:
                print(f"WARNING: Failed to start immediate build: {e}")
                # Don't fail the whole creation if build fails
        
        return CustomEEResponse(
            success=True,
            message=f"Successfully created custom environment '{custom_ee.name}'" + 
                   (f" using {custom_ee.import_mode} mode" if custom_ee.import_mode else ""),
            environment_path=str(env_path),
            build_id=build_id
        )
        
    except Exception as e:
        print(f"ERROR: Failed to create custom EE: {e}")
        return CustomEEResponse(
            success=False,
            message=f"Failed to create custom environment: {str(e)}"
        )

@app.get("/api/custom-ee/templates")
async def get_ee_templates():
    """Get common templates/examples for custom EE creation"""
    return {
        "python_packages": {
            "web_automation": ["requests", "beautifulsoup4", "selenium", "urllib3"],
            "data_science": ["pandas", "numpy", "matplotlib", "jupyter"],
            "cloud_aws": ["boto3", "botocore", "awscli"],
            "cloud_azure": ["azure-cli", "azure-identity", "azure-mgmt-compute"],
            "kubernetes": ["kubernetes", "openshift", "pyyaml"],
            "network_automation": ["netmiko", "napalm", "paramiko", "textfsm"],
            "windows": ["pywinrm", "requests-ntlm", "requests-kerberos"],
            "monitoring": ["prometheus-client", "grafana-api", "influxdb-client"]
        },
        "system_packages": {
            "development": ["gcc", "python3-devel", "make", "git"],
            "kerberos": ["krb5-devel", "krb5-libs", "krb5-workstation"],
            "ssl_crypto": ["openssl-devel", "libffi-devel"],
            "databases": ["postgresql-devel", "mysql-devel", "sqlite-devel"],
            "network": ["openssh-clients", "telnet", "nmap"],
            "containers": ["podman", "buildah", "skopeo"]
        },
        "ansible_collections": {
            "cloud_aws": ["amazon.aws", "community.aws"],
            "cloud_azure": ["azure.azcollection", "community.azure"],
            "cloud_gcp": ["google.cloud", "community.google"],
            "kubernetes": ["kubernetes.core", "community.kubernetes"],
            "network": ["cisco.ios", "juniper.junos", "arista.eos"],
            "windows": ["ansible.windows", "community.windows"],
            "linux": ["community.general", "ansible.posix"],
            "monitoring": ["community.grafana", "community.zabbix"],
            "security": ["community.crypto", "community.hashi_vault"]
        }
    }

# DASHBOARD ENDPOINT
@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics for environment health and build monitoring"""
    try:
        environments_dir = Path("environments")
        if not environments_dir.exists():
            return {"error": "Environments directory not found"}
        
        # Initialize counters
        ready_to_build = 0
        build_issues = []
        large_images = []
        recently_updated = []
        current_builds = []
        
        # DEBUG: Log current build states
        print(f"DEBUG: Dashboard stats - Running builds: {len(running_builds)}")
        print(f"DEBUG: Dashboard stats - Completed builds: {len(completed_builds)}")
        for build_id, build_info in running_builds.items():
            print(f"DEBUG: Running build {build_id}: status={build_info.get('status')}, process_running={build_info.get('process') and build_info.get('process').returncode is None}")
        
        # Analyze each environment
        for env_dir in environments_dir.iterdir():
            if not env_dir.is_dir() or env_dir.name.startswith('.'):
                continue
                
            env_name = env_dir.name
            ee_file = env_dir / "execution-environment.yml"
            
            # Check if ready to build
            env_status = analyze_environment_health(env_dir)
            
            if env_status["ready"]:
                ready_to_build += 1
            
            # Collect build issues
            if env_status["issues"]:
                build_issues.extend([{
                    "environment": env_name,
                    "issue": issue,
                    "severity": env_status["severity"]
                } for issue in env_status["issues"]])
            
            # Check for large images (estimated based on dependencies)
            estimated_size = estimate_image_size(env_dir)
            if estimated_size > 500:  # MB
                large_images.append({
                    "environment": env_name,
                    "estimated_size_mb": estimated_size
                })
            
            # Check for recently updated environments
            if ee_file.exists():
                modified_time = datetime.fromtimestamp(ee_file.stat().st_mtime)
                if modified_time > datetime.now() - timedelta(days=7):
                    recently_updated.append({
                        "environment": env_name,
                        "modified": modified_time.isoformat(),
                        "days_ago": (datetime.now() - modified_time).days
                    })
        
        # Get currently building environments - FIXED LOGIC
        for build_id, build_info in running_builds.items():
            process = build_info.get("process")
            # Check if process is actually still running
            if process and process.returncode is None:
                current_builds.append({
                    "build_id": build_id,
                    "environments": build_info["environments"],
                    "started": build_info["start_time"].isoformat(),
                    "duration_minutes": int((datetime.now() - build_info["start_time"]).total_seconds() / 60)
                })
                print(f"DEBUG: Found active build {build_id} for dashboard")
        
        # Calculate success rate from recent builds
        success_rate = calculate_build_success_rate()
        
        result = {
            "ready_to_build": ready_to_build,
            "build_issues": {
                "count": len(build_issues),
                "details": build_issues[:5]  # Top 5 issues
            },
            "large_images": {
                "count": len(large_images),
                "details": large_images[:3]  # Top 3 largest
            },
            "recently_updated": {
                "count": len(recently_updated),
                "details": sorted(recently_updated, key=lambda x: x["modified"], reverse=True)[:5]
            },
            "currently_building": {
                "count": len(current_builds),
                "details": current_builds
            },
            "success_rate": success_rate,
            "last_updated": datetime.now().isoformat()
        }
        
        print(f"DEBUG: Dashboard returning currently_building count: {len(current_builds)}")
        return result
        
    except Exception as e:
        print(f"Error getting dashboard stats: {e}")
        return {
            "error": str(e),
            "ready_to_build": 0,
            "build_issues": {"count": 0, "details": []},
            "large_images": {"count": 0, "details": []},
            "recently_updated": {"count": 0, "details": []},
            "currently_building": {"count": 0, "details": []},
            "success_rate": {"percentage": 0, "recent_builds": 0}
        }

# BUILD ENDPOINTS
@app.post("/api/builds/start", response_model=BuildResponse)
async def start_build(build_request: BuildRequest):
    """Start building selected environments using ansible-playbook"""
    try:
        selected_environments = build_request.environments
        container_runtime = build_request.container_runtime
        
        if not selected_environments:
            raise HTTPException(
                status_code=400, 
                detail="No environments specified"
            )
        
        # Validate environments exist
        environments_dir = Path("environments")
        if not environments_dir.exists():
            raise HTTPException(
                status_code=500,
                detail="Environments directory not found"
            )
            
        for env in selected_environments:
            env_path = environments_dir / env
            if not env_path.exists():
                raise HTTPException(
                    status_code=400, 
                    detail=f"Environment '{env}' not found in environments directory"
                )
            
            # Check for execution-environment.yml
            ee_file = env_path / "execution-environment.yml"
            if not ee_file.exists():
                raise HTTPException(
                    status_code=400,
                    detail=f"execution-environment.yml not found in environment '{env}'"
                )
        
        # Check if ansible-playbook exists
        try:
            process = await asyncio.create_subprocess_exec(
                "ansible-playbook", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            if process.returncode != 0:
                raise HTTPException(status_code=500, detail="ansible-playbook not found")
        except FileNotFoundError:
            raise HTTPException(status_code=500, detail="ansible-playbook not installed")
        
        # Create temporary variables file to avoid shell escaping issues
        variables = {
            "selected_environments": selected_environments,
            "container_runtime": container_runtime
        }
        
        # Create temporary file for variables
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False) as temp_file:
            yaml.dump(variables, temp_file, default_flow_style=False)
            temp_vars_file = temp_file.name
        
        # Prepare ansible-playbook command using variables file
        cmd = [
            "ansible-playbook",
            "build_environments.yml",
            "-e", f"@{temp_vars_file}",
            "-v"  # Verbose output for monitoring
        ]
        
        # Start build process (async)
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,  # Combine stderr with stdout
            cwd=os.getcwd()  # Run from current directory
        )
        
        # Generate unique build ID
        build_id = str(uuid.uuid4())
        
        # DEBUG: Log build creation
        print(f"🔍 DEBUG: Created build ID: {build_id}")
        
        # Store process info for monitoring with enhanced tracking
        running_builds[build_id] = {
            "process": process,
            "environments": selected_environments,
            "container_runtime": container_runtime,
            "temp_vars_file": temp_vars_file,  # Store for cleanup
            "status": "running",
            "start_time": datetime.now(),
            "end_time": None,
            "return_code": None,
            "logs": [
                f"🚀 Build started at {datetime.now().strftime('%H:%M:%S')}",
                f"📦 Building environments: {', '.join(selected_environments)}",
                f"🔧 Container runtime: {container_runtime}",
                f"📋 Command: {' '.join(cmd[:3])} [...]",
                "⏳ Starting ansible-playbook..."
            ],
            "successful_builds": [],
            "failed_builds": [],
            "created_at": time.time()  # For cleanup
        }
        
        # DEBUG: Log successful storage
        print(f"🔍 DEBUG: Stored build {build_id}. Total running builds: {len(running_builds)}")
        
        # Start background task to capture output
        asyncio.create_task(capture_build_output(build_id))
        
        # Cleanup old builds
        cleanup_old_builds()
        
        print(f"Started build {build_id} for environments: {selected_environments}")
        
        return BuildResponse(
            build_id=build_id,
            status="started",
            environments=selected_environments,
            message=f"Started building {len(selected_environments)} environments"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starting build: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start build: {str(e)}")

@app.get("/api/builds/{build_id}/status", response_model=BuildStatus)
async def get_build_status(build_id: str):
    """Get build status, logs, and results"""
    print(f"🔍 DEBUG: Looking for build: {build_id}")
    print(f"🔍 DEBUG: Available builds: running={list(running_builds.keys())}, completed={list(completed_builds.keys())}")
    
    build_info = get_build_info(build_id)
    if not build_info:
        print(f"❌ ERROR: Build {build_id} NOT FOUND in storage!")
        print(f"❌ This means the build was lost from memory (server restart?)")
        raise HTTPException(status_code=404, detail=f"Build {build_id} not found")
    
    print(f"✅ DEBUG: Found build {build_id} with status: {build_info.get('status')}")
    
    process = build_info.get("process")
    
    # Determine status with better logic
    if build_id in running_builds:
        if process and process.returncode is None:
            status = "running"
            end_time = None
            print(f"DEBUG: Build {build_id} is running (process active)")
        else:
            # Process finished but still in running_builds - check return code
            if build_info.get("return_code") == 0:
                status = "completed"
            else:
                status = "failed"
            end_time = build_info.get("end_time")
            print(f"DEBUG: Build {build_id} process finished, status: {status}")
            
            # Move to completed if not already moved
            if build_id in running_builds:
                print(f"DEBUG: Moving build {build_id} to completed builds")
                move_to_completed(build_id)
    else:
        # Build is in completed_builds
        if build_info.get("return_code") == 0:
            status = "completed"
        else:
            status = "failed"
        end_time = build_info.get("end_time")
        print(f"DEBUG: Build {build_id} in completed builds, status: {status}")
    
    # Update status in build_info
    build_info["status"] = status
    
    print(f"DEBUG: Build {build_id} final status: {status}, logs: {len(build_info.get('logs', []))} lines")
    
    return BuildStatus(
        build_id=build_id,
        status=status,
        environments=build_info["environments"],
        start_time=build_info["start_time"],
        end_time=end_time,
        return_code=build_info.get("return_code"),
        logs=build_info.get("logs", []),
        successful_builds=build_info.get("successful_builds", []),
        failed_builds=build_info.get("failed_builds", [])
    )

@app.get("/api/builds")
async def list_builds():
    """List all builds (running and completed)"""
    builds = []
    
    # Add running builds
    for build_id, build_info in running_builds.items():
        process = build_info.get("process")
        if process and process.returncode is None:
            status = "running"
        elif build_info.get("return_code") == 0:
            status = "completed"
        else:
            status = "failed"
            
        builds.append({
            "build_id": build_id,
            "status": status,
            "environments": build_info["environments"],
            "start_time": build_info["start_time"],
            "environment_count": len(build_info["environments"])
        })
    
    # Add completed builds
    for build_id, build_info in completed_builds.items():
        if build_info.get("return_code") == 0:
            status = "completed"
        else:
            status = "failed"
            
        builds.append({
            "build_id": build_id,
            "status": status,
            "environments": build_info["environments"],
            "start_time": build_info["start_time"],
            "end_time": build_info.get("end_time"),
            "environment_count": len(build_info["environments"])
        })
    
    return {"builds": builds}

@app.delete("/api/builds/{build_id}")
async def cancel_build(build_id: str):
    """Cancel a running build"""
    build_info = get_build_info(build_id)
    if not build_info:
        raise HTTPException(status_code=404, detail="Build not found")
    
    process = build_info.get("process")
    
    if build_id in running_builds and process and process.returncode is None:  # Still running
        try:
            process.terminate()
            await asyncio.sleep(2)  # Give it time to terminate
            if process.returncode is None:
                process.kill()  # Force kill if needed
            
            build_info["status"] = "cancelled"
            build_info["logs"].append(f"❌ Build cancelled at {datetime.now().strftime('%H:%M:%S')}")
            
            # Move to completed builds
            move_to_completed(build_id)
            
            return {"message": "Build cancelled successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to cancel build: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Build is not running")

# Background task to capture build output
async def capture_build_output(build_id: str):
    """Capture real-time output from ansible-playbook"""
    if build_id not in running_builds:
        print(f"ERROR: Build {build_id} not found when trying to capture output")
        return
    
    build_info = running_builds[build_id]
    process = build_info["process"]
    
    try:
        print(f"DEBUG: Starting output capture for build {build_id}")
        line_count = 0
        
        # Read output line by line
        while True:
            try:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=1.0)
            except asyncio.TimeoutError:
                # Check if process is still running
                if process.returncode is not None:
                    print(f"DEBUG: Process {build_id} finished, breaking from readline loop")
                    break
                continue
                
            if not line:
                print(f"DEBUG: No more lines from process {build_id}")
                break
                
            line_text = line.decode('utf-8').strip()
            if line_text:
                build_info["logs"].append(line_text)
                line_count += 1
                
                # Log progress every 10 lines
                if line_count % 10 == 0:
                    print(f"DEBUG: Build {build_id}: captured {line_count} lines")
                
                # Parse for successful/failed builds
                if "✅ Successfully built" in line_text or "Complete!" in line_text:
                    # Try to extract environment names
                    for env in build_info["environments"]:
                        if env in line_text:
                            if env not in build_info["successful_builds"]:
                                build_info["successful_builds"].append(env)
                
                elif "❌ Failed to build" in line_text or "Error:" in line_text:
                    # Try to extract environment names
                    for env in build_info["environments"]:
                        if env in line_text:
                            if env not in build_info["failed_builds"]:
                                build_info["failed_builds"].append(env)
        
        # Wait for process to complete
        print(f"DEBUG: Waiting for process {build_id} to complete...")
        await process.wait()
        
        print(f"DEBUG: Build {build_id} completed with return code: {process.returncode}")
        
        # Update final status
        build_info["return_code"] = process.returncode
        
        if process.returncode == 0:
            build_info["status"] = "completed"
            build_info["logs"].append(f"✅ Build completed successfully at {datetime.now().strftime('%H:%M:%S')}")
            # If no specific successes were detected, assume all environments succeeded
            if not build_info["successful_builds"] and not build_info["failed_builds"]:
                build_info["successful_builds"] = build_info["environments"].copy()
        else:
            build_info["status"] = "failed"
            build_info["logs"].append(f"❌ Build failed at {datetime.now().strftime('%H:%M:%S')} with return code {process.returncode}")
            # If no specific failures were detected, assume all environments failed
            if not build_info["failed_builds"] and not build_info["successful_builds"]:
                build_info["failed_builds"] = build_info["environments"].copy()
        
        # Clean up temporary variables file
        try:
            if "temp_vars_file" in build_info:
                os.unlink(build_info["temp_vars_file"])
                print(f"DEBUG: Cleaned up temp file for build {build_id}")
        except Exception as cleanup_error:
            build_info["logs"].append(f"Warning: Could not clean up temp file: {cleanup_error}")
        
        # Move to completed builds
        print(f"DEBUG: Moving build {build_id} to completed storage")
        move_to_completed(build_id)
        
        print(f"DEBUG: Build {build_id} output capture completed. Total lines: {len(build_info['logs'])}")
            
    except Exception as e:
        print(f"ERROR: Error capturing output for build {build_id}: {e}")
        build_info["logs"].append(f"Error capturing output: {str(e)}")
        build_info["status"] = "failed"
        build_info["return_code"] = -1
        
        # Clean up temporary variables file on error
        try:
            if "temp_vars_file" in build_info:
                os.unlink(build_info["temp_vars_file"])
        except Exception:
            pass  # Ignore cleanup errors during error handling
        
        # Move to completed builds even on error
        move_to_completed(build_id)

# ENVIRONMENT ENDPOINTS
@app.get("/api/environments")
async def get_environments():
    """Get list of available environments"""
    environments = []
    environments_dir = Path("environments")
    
    if not environments_dir.exists():
        return {"environments": []}
    
    for env_dir in environments_dir.iterdir():
        if env_dir.is_dir() and not env_dir.name.startswith('.'):
            ee_file = env_dir / "execution-environment.yml"
            if ee_file.exists():
                environments.append({
                    "name": env_dir.name,
                    "path": str(env_dir),
                    "has_execution_environment": True
                })
    
    return {"environments": sorted(environments, key=lambda x: x["name"])}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
