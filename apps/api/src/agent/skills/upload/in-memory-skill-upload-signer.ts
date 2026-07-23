import type {
  SignedSkillUpload,
  SignSkillUploadInput,
  SkillUploadSignerPort,
} from './skill-upload-signer.port'

export class InMemorySkillUploadSigner implements SkillUploadSignerPort {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async signSkillUpload(input: SignSkillUploadInput): Promise<SignedSkillUpload> {
    return {
      url: `https://oss.invalid/${encodeURIComponent(input.objectKey)}?fixture-signature=redacted`,
      method: 'PUT',
      headers: requiredHeaders(input),
      expiresAt: new Date(this.now().getTime() + input.expiresInSeconds * 1_000).toISOString(),
    }
  }
}

export function requiredHeaders(input: SignSkillUploadInput): Record<string, string> {
  return {
    'content-type': input.contentType,
    'x-oss-object-acl': 'private',
    'x-oss-meta-kind': 'skill-package',
    'x-oss-meta-sha256': input.sha256,
  }
}
