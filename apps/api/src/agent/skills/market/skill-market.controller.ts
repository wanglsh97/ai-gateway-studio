import { Controller, Get, Inject, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { ListSkillMarketQueryDto } from './skill-market.dto'
import { SkillMarketService } from './skill-market.service'

@ApiTags('Skill Market')
@Controller('skills')
export class SkillMarketController {
  constructor(@Inject(SkillMarketService) private readonly market: SkillMarketService) {}

  @Get()
  list(@Query() query: ListSkillMarketQueryDto) {
    return this.market.list(query)
  }

  @Get(':name')
  detail(@Param('name') name: string) {
    return this.market.detail(name)
  }
}
