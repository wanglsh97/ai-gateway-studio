import type { CreateAgentRunRequest } from '@aigateway/sdk'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateAgentRunDto implements CreateAgentRunRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(8_000)
  declare input: string
}
