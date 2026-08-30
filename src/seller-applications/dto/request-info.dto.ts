import { IsString } from 'class-validator';

export class RequestInfoDto {
  @IsString()
  note: string;
}
