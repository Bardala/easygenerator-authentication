import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpReqDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 3, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 100)
  name!: string;

  @ApiProperty({
    format: 'password',
    minLength: 8,
    maxLength: 128,
    description:
      'Contains a letter, a digit, and a punctuation or symbol character.',
  })
  @IsString()
  @Length(8, 128)
  @Matches(/\p{L}/u, { message: 'Password must contain at least one letter.' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number.' })
  @Matches(/[\p{P}\p{S}]/u, {
    message: 'Password must contain at least one special character.',
  })
  password!: string;
}
