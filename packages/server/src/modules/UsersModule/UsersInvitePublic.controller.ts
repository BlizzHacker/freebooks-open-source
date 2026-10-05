import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicRoute } from '@/modules/Auth/guards/jwt.guard';
import { UsersApplication } from './Users.application';
import { InviteUserDto } from './dtos/InviteUser.dto';

@Controller('invite')
@ApiTags('Users')
@PublicRoute()
export class UsersInvitePublicController {
  constructor(private readonly usersApplication: UsersApplication) {}

  /**
   * Accept a user invitation.
   */
  @Post('accept/:token')
  @ApiOperation({ summary: 'Accept a user invitation.' })
  async acceptInvite(
    @Param('token') token: string,
    @Body() inviteUserDTO: InviteUserDto,
  ) {
    await this.usersApplication.acceptInvite(token, inviteUserDTO);

    return {
      message: 'The invitation has been accepted successfully.',
    };
  }

  /**
   * Check if an invitation token is valid.
   */
  @Get('check/:token')
  @ApiOperation({ summary: 'Check if an invitation token is valid.' })
  async checkInvite(@Param('token') token: string) {
    const inviteDetails = await this.usersApplication.checkInvite(token);

    return inviteDetails;
  }
}
