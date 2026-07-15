import type { ChatMessage, TextModelAlias } from '@aigateway/sdk'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

import { TEXT_MODEL_ALIASES } from '../chat.constants'

export class ChatMessageDto implements ChatMessage {
  @IsIn(['system', 'user', 'assistant'])
  declare role: ChatMessage['role']

  @IsString()
  @MinLength(1)
  declare content: string
}

export class ChatCompletionRequestDto {
  @IsIn(TEXT_MODEL_ALIASES)
  declare model: TextModelAlias

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  declare messages: ChatMessageDto[]

  @IsBoolean()
  @Equals(true)
  declare stream: true

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  declare temperature?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  declare maxTokens?: number
}
