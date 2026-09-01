// tsx file, same shape as Account but required email -> should match User/Person/Account cluster
export interface UserCardProps {
  id: string;
  name: string;
  email: string;
}

export function UserCard(props: UserCardProps) {
  return null;
}
