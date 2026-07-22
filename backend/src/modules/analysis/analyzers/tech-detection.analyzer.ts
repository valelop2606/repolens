import { RepositoryTree, PartialAnalysisResult, Technology } from '../../../shared/types';
import { Analyzer } from '../interfaces/analyzer.interface';

/**
 * Stage 2 of the analysis pipeline — Technology Detection.
 *
 * Detection strategy (in priority order):
 *  1. package.json dependencies  → confidence: "high"
 *  2. File extensions present    → confidence: "medium"
 *  3. Config file presence       → confidence: "medium"
 */
export class TechDetectionAnalyzer implements Analyzer {
  readonly name = 'TechDetectionAnalyzer';

  /** Always applicable — every repo has some detectable technology. */
  detect(_repo: RepositoryTree): boolean {
    return true;
  }

  async analyze(repo: RepositoryTree): Promise<PartialAnalysisResult> {
    const technologies: Technology[] = [];
    const deps = this._getDependencies(repo);
    const extensions = new Set(repo.files.map((f) => f.extension));
    const filenames = new Set(repo.files.map((f) => f.relativePath.split('/').pop() ?? ''));

    const knownDeps: Array<[string, string]> = [
      ['react', 'React'],
      ['react-dom', 'React DOM'],
      ['react-router-dom', 'React Router'],
      ['@nestjs/core', 'NestJS'],
      ['@nestjs/common', 'NestJS'],
      ['express', 'Express'],
      ['fastify', 'Fastify'],
      ['mongoose', 'Mongoose'],
      ['@nestjs/mongoose', 'Mongoose'],
      ['sequelize', 'Sequelize'],
      ['typeorm', 'TypeORM'],
      ['prisma', 'Prisma'],
      ['axios', 'Axios'],
      ['rxjs', 'RxJS'],
      ['@aws-sdk/client-bedrock-runtime', 'AWS Bedrock'],
      ['@aws-sdk/client-s3', 'AWS S3'],
      ['vite', 'Vite'],
      ['webpack', 'Webpack'],
      ['jest', 'Jest'],
      ['typescript', 'TypeScript'],
    ];

    const seen = new Set<string>();

    // 1. Dependencies → high confidence
    for (const [dep, techName] of knownDeps) {
      if (deps.has(dep) && !seen.has(techName)) {
        seen.add(techName);
        technologies.push({ name: techName, confidence: 'high', detectedBy: `package.json dependency: ${dep}` });
      }
    }

    // 2. File extensions → medium confidence
    if (!seen.has('TypeScript') && (extensions.has('.ts') || extensions.has('.tsx'))) {
      seen.add('TypeScript');
      technologies.push({ name: 'TypeScript', confidence: 'medium', detectedBy: 'file extension .ts/.tsx' });
    }
    if (!seen.has('React') && extensions.has('.tsx')) {
      seen.add('React');
      technologies.push({ name: 'React', confidence: 'medium', detectedBy: 'file extension .tsx' });
    }
    if (extensions.has('.py') && !seen.has('Python')) {
      seen.add('Python');
      technologies.push({ name: 'Python', confidence: 'medium', detectedBy: 'file extension .py' });
    }
    if (extensions.has('.java') && !seen.has('Java')) {
      seen.add('Java');
      technologies.push({ name: 'Java', confidence: 'medium', detectedBy: 'file extension .java' });
    }

    // 3. Config files → medium confidence
    if (filenames.has('tsconfig.json') && !seen.has('TypeScript')) {
      seen.add('TypeScript');
      technologies.push({ name: 'TypeScript', confidence: 'medium', detectedBy: 'tsconfig.json present' });
    }
    if ((filenames.has('vite.config.ts') || filenames.has('vite.config.js')) && !seen.has('Vite')) {
      seen.add('Vite');
      technologies.push({ name: 'Vite', confidence: 'medium', detectedBy: 'vite.config file present' });
    }
    if (filenames.has('nest-cli.json') && !seen.has('NestJS')) {
      seen.add('NestJS');
      technologies.push({ name: 'NestJS', confidence: 'medium', detectedBy: 'nest-cli.json present' });
    }

    return { technologies };
  }

  private _getDependencies(repo: RepositoryTree): Set<string> {
    const pkg = repo.packageJson ?? {};
    const deps = {
      ...((pkg['dependencies'] as Record<string, string>) ?? {}),
      ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
    };
    return new Set(Object.keys(deps));
  }
}
