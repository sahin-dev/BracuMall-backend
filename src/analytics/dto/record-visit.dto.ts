import { IsString, MaxLength, MinLength } from 'class-validator';

export class RecordVisitDto {
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  visitorId: string;
}
