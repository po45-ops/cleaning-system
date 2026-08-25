import type { PasswordVerifier } from "./password-utils";

export type StudentCredential = PasswordVerifier & { id: string };

export const COUNCIL_ACCOUNT_IDS = Array.from(
  { length: 9 },
  (_, index) => `สภา${String(index + 1).padStart(2, "0")}`
);

const DEFAULT_STUDENT_CREDENTIALS: readonly StudentCredential[] = [
  {
    id: "สภา01",
    salt: "6b815ebc777376b8a2c7273ae7b9ddab",
    passwordHash:
      "1de80ad260751b74f2047175cc3d13c66aa28f37fb0cb2f4d07344a0cf55c248",
  },
  {
    id: "สภา02",
    salt: "26fe221d517c381a4e96ed018a5763fc",
    passwordHash:
      "d2ef47d243e768c2a31a458f507fb5f8758d8c89f93a10b0f77dcc009b56d5ad",
  },
  {
    id: "สภา03",
    salt: "1003730fd83c30e471f0c49244a886b4",
    passwordHash:
      "ef63cfa11ef87f2a3cbcddfd3bab094b8d356d9c345225a5b0023f07a3bffff3",
  },
  {
    id: "สภา04",
    salt: "07c50dbbb092d12848e4849e5595860b",
    passwordHash:
      "94bc7ebc1f33d8f1171d085dab4ee5c1224f765896666fa712fcf2c3431bc107",
  },
  {
    id: "สภา05",
    salt: "57bc77dffd8dd91e7f77dfc815b9c3c1",
    passwordHash:
      "c47370e1705df9a8c58bf18b3cc3d6ad26bacac8fe23247d6c49fc8444fce561",
  },
  {
    id: "สภา06",
    salt: "3f26d1fe0f9180e23a16f481b2294ed9",
    passwordHash:
      "00fd154798631b00a2d7359bf37147fb5c4ff8f227a1082ad850ea7c48098079",
  },
  {
    id: "สภา07",
    salt: "c1c6e5a38a4d9f6e8a219b90a30e4653",
    passwordHash:
      "aa0987c62b3bdcdc5c93a45641fa521f260e53f92d526a9c395a38512da1c385",
  },
  {
    id: "สภา08",
    salt: "7f3eb9d727c3de7d22d323a50f983492",
    passwordHash:
      "9ae9ebf200df506044d8246a0e288c3bdce8709c263667d50cb3e5d145e29b73",
  },
  {
    id: "สภา09",
    salt: "d813e64c96c62472d70dd22f10d73845",
    passwordHash:
      "ebff443f1720029f4e1df78f5658b8ab49a917e78ad1c05386706bb04259e46a",
  },
];

export const getDefaultStudentCredentials = (): StudentCredential[] =>
  DEFAULT_STUDENT_CREDENTIALS.map((credential) => ({ ...credential }));
