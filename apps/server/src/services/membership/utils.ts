import { MembershipDoc } from '../../models/membership.js';

export class MembershipUtils {
  public static groupMembershipDocsByMembershipRole = <T extends MembershipDoc>(
    membershipDocs: T[],
  ): Record<string, T[]> =>
    membershipDocs.reduce<Record<string, T[]>>((prev, membershipDoc) => {
      const roleId = membershipDoc.membershipRole;
      return { ...prev, [roleId]: [...(roleId in prev ? prev[roleId] : []), membershipDoc] };
    }, {});
}
