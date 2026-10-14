import { ApiProperty } from '@nestjs/swagger';
import { UserResDto } from '../../users/dtos/user-res.dto.js';

export class CsrfResDto {
  @ApiProperty() csrfToken!: string;
}
export class AuthenticationResDto extends CsrfResDto {
  @ApiProperty({ type: UserResDto }) user!: UserResDto;
}
export class CurrentUserResDto {
  @ApiProperty({ type: UserResDto }) user!: UserResDto;
}
