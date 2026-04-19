import type { ApiClient } from './api-client.js'
import type { ServicesListResult, ServiceEndpointsResult } from '../types/commands.js'

export async function listServices(
  client: ApiClient,
  timestamp: string,
): Promise<ServicesListResult> {
  const { data, provider } = await client.get<{
    services: ServicesListResult['services']
  }>('/api/v1/services')
  return { services: data.services, provider, timestamp }
}

export async function getServiceEndpoints(
  client: ApiClient,
  service: string,
  timestamp: string,
): Promise<ServiceEndpointsResult> {
  const { data, provider } = await client.get<{
    service: string
    endpoints: ServiceEndpointsResult['endpoints']
  }>(`/api/v1/services/${encodeURIComponent(service)}/endpoints`)
  return { service: data.service, endpoints: data.endpoints, provider, timestamp }
}