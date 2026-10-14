import { ApiProperty } from '@nestjs/swagger';

export class UserResDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() name!: string;
}
