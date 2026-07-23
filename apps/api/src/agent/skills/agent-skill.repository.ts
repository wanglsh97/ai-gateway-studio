import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'

export interface UserAgentSkillState {
  skillId: string
}

@Injectable()
export class AgentSkillRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<readonly UserAgentSkillState[]> {
    return this.prisma.userAgentSkill.findMany({
      where: { userId },
      select: { skillId: true },
      orderBy: { skillId: 'asc' },
    })
  }

  async install(userId: string, skillId: string): Promise<UserAgentSkillState> {
    return this.prisma.userAgentSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId },
      update: {},
      select: { skillId: true },
    })
  }

  async uninstall(userId: string, skillId: string): Promise<void> {
    await this.prisma.userAgentSkill.deleteMany({ where: { userId, skillId } })
  }
}
