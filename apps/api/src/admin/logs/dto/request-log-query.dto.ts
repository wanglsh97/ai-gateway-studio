import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export const REQUEST_LOG_CAPABILITIES = ['chat', 'image', 'prompt'] as const
export const REQUEST_LOG_STATUSES = ['pending', 'succeeded', 'failed', 'cancelled'] as const
export const REQUEST_LOG_MODELS = [
  'qwen',
  'glm',
  'deepseek',
  'kimi',
  'wanxiang',
  'cogview',
] as const

export class RequestLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  declare page?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare pageSize?: number

  @IsOptional()
  @IsISO8601({ strict: true })
  declare from?: string

  @IsOptional()
  @IsISO8601({ strict: true })
  declare to?: string

  @IsOptional()
  @IsIn(REQUEST_LOG_CAPABILITIES)
  declare capability?: (typeof REQUEST_LOG_CAPABILITIES)[number]

  @IsOptional()
  @IsIn(REQUEST_LOG_MODELS)
  declare model?: (typeof REQUEST_LOG_MODELS)[number]

  @IsOptional()
  @IsIn(REQUEST_LOG_STATUSES)
  declare status?: (typeof REQUEST_LOG_STATUSES)[number]

  @IsOptional()
  @IsUUID()
  declare requestId?: string

  @IsOptional()
  @MaxLength(39)
  @Matches(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
  declare githubUsername?: string

  @IsOptional()
  @MaxLength(32)
  @Matches(/^\d+$/)
  declare githubId?: string
}
