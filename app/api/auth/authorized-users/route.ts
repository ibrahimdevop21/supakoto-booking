import { NextResponse } from 'next/server';
import { getAuthorizedUsers } from '@/lib/authorizedUsers';

export async function GET() {
  const users = getAuthorizedUsers().map((u) => u.name);
  return NextResponse.json({ users });
}
