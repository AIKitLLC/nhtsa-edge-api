/**
 * Which vPIC tables/columns are kept in data/vpic (the git-tracked source of truth).
 * Everything the port of spVinDecode reads is here; nothing else is.
 */

export interface TableSpec {
  /** Table name in the dump (lowercase, without the "vpic." schema). */
  readonly table: string;
  /** Output columns. Each is either a dump column or a derived one (see `derive`). */
  readonly columns: readonly string[];
  /** Columns holding timestamps to normalize (see normalizeTimestamp). */
  readonly timestamps?: readonly string[];
  /** Number of output shards (by `shardBy` modulo); 1 = a single file. */
  readonly shards?: number;
  readonly shardBy?: string;
  /** Column(s) used to sort rows so the files are deterministic and diff well. */
  readonly sortBy: readonly string[];
}

/** Lookup tables referenced by vpic.fElementAttributeValue (all have id + name). */
export const LOOKUP_TABLES: readonly string[] = [
  "abs",
  "adaptivecruisecontrol",
  "adaptivedrivingbeam",
  "airbaglocations",
  "airbaglocfront",
  "airbaglocknee",
  "autobrake",
  "automaticpedestrainalertingsound",
  "autoreversesystem",
  "axleconfiguration",
  "batterytype",
  "bedtype",
  "blindspotintervention",
  "blindspotmonitoring",
  "bodycab",
  "bodystyle",
  "brakesystem",
  "busfloorconfigtype",
  "bustype",
  "can_aacn",
  "chargerlevel",
  "combinedbrakingsystem",
  "coolingtype",
  "country",
  "custommotorcycletype",
  "daytimerunninglight",
  "destinationmarket",
  "drivetype",
  "dynamicbrakesupport",
  "ecs",
  "edr",
  "electrificationlevel",
  "engineconfiguration",
  "entertainmentsystem",
  "evdriveunit",
  "forwardcollisionwarning",
  "fueldeliverytype",
  "fueltankmaterial",
  "fueltanktype",
  "fueltype",
  "grossvehicleweightrating",
  "keylessignition",
  "lanecenteringassistance",
  "lanedeparturewarning",
  "lanekeepsystem",
  "lowerbeamheadlamplightsource",
  "motorcyclechassistype",
  "motorcyclesuspensiontype",
  "nonlanduse",
  "parkassist",
  "pedestrianautomaticemergencybraking",
  "pretensioner",
  "rearautomaticemergencybraking",
  "rearcrosstrafficalert",
  "rearvisibilitycamera",
  "seatbeltsall",
  "semiautomaticheadlampbeamswitching",
  "steering",
  "tpms",
  "tractioncontrol",
  "trailerbodytype",
  "trailertype",
  "transmission",
  "turbo",
  "valvetraindesign",
  "vehicletype",
  "wheelbasetype",
  "wheeliemitigation",
  // large name tables, same shape
  "make",
  "model",
  "manufacturer",
];

const LOOKUP_SPECS: TableSpec[] = LOOKUP_TABLES.map((table) => ({
  table,
  columns: ["id", "name"],
  sortBy: ["id"],
}));

export const TABLE_SPECS: readonly TableSpec[] = [
  ...LOOKUP_SPECS,
  {
    table: "wmi",
    columns: [
      "id",
      "wmi",
      "manufacturerid",
      "makeid",
      "vehicletypeid",
      "trucktypeid",
      "countryid",
      "publicavailabilitydate",
      "changedon",
    ],
    timestamps: ["publicavailabilitydate", "changedon"],
    sortBy: ["id"],
  },
  { table: "wmi_make", columns: ["wmiid", "makeid"], sortBy: ["wmiid", "makeid"] },
  {
    table: "wmi_vinschema",
    columns: ["id", "wmiid", "vinschemaid", "yearfrom", "yearto"],
    sortBy: ["id"],
  },
  { table: "vinschema", columns: ["id", "name", "tobeqced"], sortBy: ["id"] },
  {
    table: "pattern",
    columns: ["id", "vinschemaid", "keys", "elementid", "attributeid", "changedon"],
    timestamps: ["changedon"],
    shards: 16,
    shardBy: "vinschemaid",
    sortBy: ["id"],
  },
  {
    table: "element",
    columns: ["id", "name", "code", "lookuptable", "isprivate", "groupname", "datatype", "decode", "weight"],
    sortBy: ["id"],
  },
  { table: "make_model", columns: ["id", "makeid", "modelid"], sortBy: ["id"] },
  { table: "enginemodel", columns: ["id", "name"], sortBy: ["id"] },
  {
    table: "enginemodelpattern",
    columns: ["id", "enginemodelid", "elementid", "attributeid", "changedon"],
    timestamps: ["changedon"],
    sortBy: ["id"],
  },
  { table: "conversion", columns: ["id", "fromelementid", "toelementid", "formula"], sortBy: ["id"] },
  {
    table: "defaultvalue",
    columns: ["id", "elementid", "vehicletypeid", "defaultvalue", "changedon"],
    timestamps: ["changedon"],
    sortBy: ["id"],
  },
  { table: "errorcode", columns: ["id", "name", "additionalerrortext", "weight"], sortBy: ["id"] },
  { table: "vinexception", columns: ["id", "vin", "checkdigit"], sortBy: ["id"] },
  { table: "vindescriptor", columns: ["id", "descriptor", "modelyear"], sortBy: ["id"] },
  {
    table: "vehiclespecschema",
    columns: ["id", "makeid", "vehicletypeid", "tobeqced"],
    sortBy: ["id"],
  },
  { table: "vspecschemapattern", columns: ["id", "schemaid"], sortBy: ["id"] },
  {
    table: "vehiclespecpattern",
    columns: ["id", "vspecschemapatternid", "iskey", "elementid", "attributeid", "changedon"],
    timestamps: ["changedon"],
    sortBy: ["id"],
  },
  {
    table: "vehiclespecschema_model",
    columns: ["id", "vehiclespecschemaid", "modelid"],
    sortBy: ["id"],
  },
  {
    table: "vehiclespecschema_year",
    columns: ["id", "vehiclespecschemaid", "year"],
    sortBy: ["id"],
  },
];

/**
 * `changedon` is derived as COALESCE(updatedon, createdon), exactly how every
 * decode query orders rows ("coalesce(P.UpdatedOn, P.CreatedOn)").
 */
export function deriveColumn(column: string, row: Readonly<Record<string, string | null>>): string | null {
  if (column === "changedon") {
    return row["updatedon"] ?? row["createdon"] ?? null;
  }
  const value = row[column];
  if (value === undefined) {
    throw new Error(`Column '${column}' missing from dump row`);
  }
  return value;
}
