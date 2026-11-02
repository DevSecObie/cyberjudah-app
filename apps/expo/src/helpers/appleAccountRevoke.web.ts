/**
 * The web app has no native Sign in with Apple session to revoke; Firebase's recent-login check
 * in deleteAccountWithData still guards the deletion.
 */
export async function revokeAppleSignInIfLinked(): Promise<void> {}
