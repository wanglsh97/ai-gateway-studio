import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../database/prisma.service'

export interface UserAgentSkillState {
  skillId: string
  enabled: boolean
}

@Injectable()
export class AgentSkillRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<readonly UserAgentSkillState[]> {
    return this.prisma.userAgentSkill.findMany({
      where: { userId },
      select: { skillId: true, enabled: true },
      orderBy: { skillId: 'asc' },
    })
  }

  async install(userId: string, skillId: string): Promise<UserAgentSkillState> {
    return this.prisma.userAgentSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, enabled: true },
      update: { enabled: true },
      select: { skillId: true, enabled: true },
    })
  }

  async setEnabled(
    userId: string,
    skillId: string,
    enabled: boolean,
  ): Promise<UserAgentSkillState | null> {
    const result = await this.prisma.userAgentSkill.updateMany({
      where: { userId, skillId },
      data: { enabled },
    })
    return result.count === 0 ? null : { skillId, enabled }
  }

  async uninstall(userId: string, skillId: string): Promise<void> {
    await this.prisma.userAgentSkill.deleteMany({ where: { userId, skillId } })
  }
}
