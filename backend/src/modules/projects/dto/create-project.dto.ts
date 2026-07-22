import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
