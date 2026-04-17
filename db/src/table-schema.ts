export const TABLE_INDEXES = {
  primary: { pk: "pk", sk: "sk" },
  gsi1: { name: "gsi1", pk: "gsi1pk", sk: "gsi1sk" },
  gsi2: { name: "gsi2", pk: "gsi2pk", sk: "gsi2sk" },
  gsi3: { name: "gsi3", pk: "gsi3pk", sk: "gsi3sk" },
} as const;

export const SERVICE = "eduboost";
