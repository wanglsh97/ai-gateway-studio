import type { CreateAgentThreadRequest, UpdateAgentThreadRequest } from '@aigateway/sdk'
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class CreateAgentThreadDto implements CreateAgentThreadRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  declare model: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare title?: string
}

export class UpdateAgentThreadDto implements UpdateAgentThreadRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare title: string
}
