export const PROPERTY_EMPIRE_BOARD_VERSION = 1 as const;

export type PropertyGroup = "HARBOR_WORKS" | "GARDEN_GUILD" | "ARTS_QUARTER" | "INNOVATION_BELT";
export type PropertyPattern = "WAVES" | "LEAVES" | "HATCH" | "DOTS";
export type PropertyTile = { id: string; index: number; type: "PROPERTY"; name: string; group: PropertyGroup; pattern: PropertyPattern; price: number; baseRent: number };
export type OriginTile = { id: string; index: number; type: "ORIGIN"; name: string };
export type EventTile = { id: string; index: number; type: "EVENT"; name: string; deck: "MARKET_SIGNAL" | "CIVIC_DISPATCH" };
export type TaxTile = { id: string; index: number; type: "TAX"; name: string; amount: number };
export type HoldTile = { id: string; index: number; type: "HOLD"; name: string };
export type RestTile = { id: string; index: number; type: "REST"; name: string };
export type PropertyEmpireTile = PropertyTile | OriginTile | EventTile | TaxTile | HoldTile | RestTile;

export const PROPERTY_EMPIRE_BOARD: readonly PropertyEmpireTile[] = [
  { id: "founders-gate", index: 0, type: "ORIGIN", name: "Founders' Gate" },
  { id: "copper-quay", index: 1, type: "PROPERTY", name: "Copper Quay", group: "HARBOR_WORKS", pattern: "WAVES", price: 100, baseRent: 20 },
  { id: "market-signal-1", index: 2, type: "EVENT", name: "Market Signal", deck: "MARKET_SIGNAL" },
  { id: "kiteworks-yard", index: 3, type: "PROPERTY", name: "Kiteworks Yard", group: "HARBOR_WORKS", pattern: "WAVES", price: 110, baseRent: 22 },
  { id: "civic-contribution", index: 4, type: "TAX", name: "Civic Contribution", amount: 60 },
  { id: "juniper-arcade", index: 5, type: "PROPERTY", name: "Juniper Arcade", group: "GARDEN_GUILD", pattern: "LEAVES", price: 120, baseRent: 24 },
  { id: "rest-pavilion", index: 6, type: "REST", name: "Rest Pavilion" },
  { id: "mosslight-market", index: 7, type: "PROPERTY", name: "Mosslight Market", group: "GARDEN_GUILD", pattern: "LEAVES", price: 130, baseRent: 26 },
  { id: "civic-dispatch-1", index: 8, type: "EVENT", name: "Civic Dispatch", deck: "CIVIC_DISPATCH" },
  { id: "lantern-row", index: 9, type: "PROPERTY", name: "Lantern Row", group: "GARDEN_GUILD", pattern: "LEAVES", price: 140, baseRent: 28 },
  { id: "transit-hold", index: 10, type: "HOLD", name: "Transit Hold" },
  { id: "emberline-studios", index: 11, type: "PROPERTY", name: "Emberline Studios", group: "ARTS_QUARTER", pattern: "HATCH", price: 160, baseRent: 32 },
  { id: "market-signal-2", index: 12, type: "EVENT", name: "Market Signal", deck: "MARKET_SIGNAL" },
  { id: "canvas-court", index: 13, type: "PROPERTY", name: "Canvas Court", group: "ARTS_QUARTER", pattern: "HATCH", price: 170, baseRent: 34 },
  { id: "infrastructure-fund", index: 14, type: "TAX", name: "Infrastructure Fund", amount: 80 },
  { id: "tideglass-labs", index: 15, type: "PROPERTY", name: "Tideglass Labs", group: "INNOVATION_BELT", pattern: "DOTS", price: 180, baseRent: 36 },
  { id: "river-commons", index: 16, type: "REST", name: "River Commons" },
  { id: "northstar-foundry", index: 17, type: "PROPERTY", name: "Northstar Foundry", group: "INNOVATION_BELT", pattern: "DOTS", price: 190, baseRent: 38 },
  { id: "civic-dispatch-2", index: 18, type: "EVENT", name: "Civic Dispatch", deck: "CIVIC_DISPATCH" },
  { id: "meridian-exchange", index: 19, type: "PROPERTY", name: "Meridian Exchange", group: "INNOVATION_BELT", pattern: "DOTS", price: 200, baseRent: 40 },
];

export const PROPERTY_TILES = PROPERTY_EMPIRE_BOARD.filter((tile): tile is PropertyTile => tile.type === "PROPERTY");
export const TRANSIT_HOLD_INDEX = PROPERTY_EMPIRE_BOARD.findIndex((tile) => tile.type === "HOLD");
export const getPropertyEmpireTile = (tileId: string) => PROPERTY_EMPIRE_BOARD.find((tile) => tile.id === tileId);
