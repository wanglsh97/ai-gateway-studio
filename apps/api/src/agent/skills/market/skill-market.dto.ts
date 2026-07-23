import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

import { SKILL_CATEGORIES } from '../publishing/skill-publishing.service'

export class ListSkillMarketQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare keyword?: string

  @IsOptional()
  @IsIn(SKILL_CATEGORIES)
  declare category?: (typeof SKILL_CATEGORIES)[number]

  @IsOptional()
  @IsIn(['latest', 'popular'])
  sort: 'latest' | 'popular' = 'latest'
}
