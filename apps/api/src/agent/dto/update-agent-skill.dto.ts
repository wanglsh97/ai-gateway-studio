import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class UpdateAgentSkillDto {
  @ApiProperty({
    description: 'Whether the installed Skill is loaded for future Agent model calls',
  })
  @IsBoolean()
  enabled!: boolean
}
