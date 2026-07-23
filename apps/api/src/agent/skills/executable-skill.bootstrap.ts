import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'

import { ExecutableSkillService } from './executable-skill.service'

@Injectable()
export class ExecutableSkillBootstrap implements OnModuleInit {
  constructor(@Inject(ExecutableSkillService) private readonly skills: ExecutableSkillService) {}

  async onModuleInit(): Promise<void> {
    await this.skills.ensureMockPublishedSkill()
  }
}
