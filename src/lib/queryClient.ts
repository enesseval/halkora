import { QueryClient } from '@tanstack/react-query';

// Module-level (not created inside app/_layout.tsx) so plain non-hook code —
// src/hooks/useAuth.ts's signOut/deleteAccount — can wipe the whole cache
// when the signed-in account changes. Without that wipe, the next account on
// this device starts from the previous account's cached queries.
export const queryClient = new QueryClient();
