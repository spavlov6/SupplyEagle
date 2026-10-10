import { IsString, MaxLength } from 'class-validator';

export class PinClockDto {
  @IsString()
  @MaxLength(80)
  timezone: string;
}
