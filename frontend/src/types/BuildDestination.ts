// frontend/src/types/BuildDestination.ts

export interface BuildDestination {
  type: 'local' | 'export' | 'push' | 'export_and_push';
  label: string;
  description: string;
}

export interface ExportConfig {
  enabled: boolean;
  containerRuntime?: string;
}

export interface PushConfig {
  enabled: boolean;
  registryUrl?: string;
  repository?: string;
  tag?: string;
  credentials?: {
    username: string;
    password: string;
  };
  containerRuntime?: string;
}

export interface BuildDestinationConfig {
  destination: BuildDestination['type'];
  export?: ExportConfig;
  push?: PushConfig;
}

export interface EnhancedBuildRequest {
  environments: string[];
  container_runtime: string;
  destinations: BuildDestinationConfig;
}

export interface PostBuildOperation {
  type: 'export' | 'push';
  status: 'pending' | 'running' | 'completed' | 'failed';
  operation_id?: string;
  image_name: string;
  target_url?: string;
  error_message?: string;
  start_time?: string;
  end_time?: string;
}

export interface EnhancedBuildStatus {
  id: string;
  build_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'lost' | 'starting';
  environments: string[];
  started_at: string;
  start_time: string;
  end_time?: string;
  build_time_seconds?: number;
  return_code?: number;
  logs: string[];
  successful_builds: string[];
  failed_builds: string[];
  images: any[];
  post_build_operations?: PostBuildOperation[];
}

export const BUILD_DESTINATIONS: BuildDestination[] = [
  {
    type: 'local',
    label: 'Local Only',
    description: 'Build and store images locally only'
  },
  {
    type: 'export',
    label: 'Local + Export .tar',
    description: 'Build locally and export as downloadable .tar files'
  },
  {
    type: 'push',
    label: 'Local + Push to Registry',
    description: 'Build locally and push to container registry'
  },
  {
    type: 'export_and_push',
    label: 'Local + Export + Push',
    description: 'Build locally, export .tar files, and push to registry'
  }
];
