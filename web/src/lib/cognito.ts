import {
  CognitoUser,
  CognitoUserPool,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { env } from "./env";

export type Role = "parent" | "student" | "teacher";

let pool: CognitoUserPool | null = null;

export function userPool() {
  if (!pool) {
    pool = new CognitoUserPool({ UserPoolId: env.userPoolId, ClientId: env.userPoolClientId });
  }
  return pool;
}

export function signUp(email: string, password: string, role: Role, tosAcceptedAt: string) {
  return new Promise<void>((resolve, reject) => {
    userPool().signUp(
      email,
      password,
      [
        new CognitoUserAttribute({ Name: "email", Value: email }),
        new CognitoUserAttribute({ Name: "custom:role", Value: role }),
        new CognitoUserAttribute({ Name: "custom:tos_accepted_at", Value: tosAcceptedAt }),
      ],
      [],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

export function confirmSignUp(email: string, code: string) {
  return new Promise<void>((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.confirmRegistration(code, true, (err) => (err ? reject(err) : resolve()));
  });
}

export function signIn(email: string, password: string) {
  return new Promise<CognitoUserSession>((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool() });
    user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function currentSession() {
  return new Promise<CognitoUserSession | null>((resolve) => {
    const user = userPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((_err: Error | null, session: CognitoUserSession | null) => resolve(session ?? null));
  });
}

export function signOut() {
  userPool().getCurrentUser()?.signOut();
}

export function currentRole(session: CognitoUserSession | null): Role | null {
  if (!session) return null;
  const payload = session.getIdToken().payload as Record<string, unknown>;
  const role = payload["custom:role"];
  if (role === "parent" || role === "student" || role === "teacher") return role;
  return null;
}
