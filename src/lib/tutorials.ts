export const TUTORIALS = {
  attendance:      "https://drive.google.com/file/d/1tVrpJF0tlk1oXmSq0xAeIbRuyIo4twxY/preview",
  dashboard:       "https://drive.google.com/file/d/1z9u9Ws5wkziG6PYpYi6EpW7B81g0njwz/preview",
  leads:           "https://drive.google.com/file/d/1pvFj-EfkMLWQGxlNORN_JFTwU-i8HfcJ/preview",
  addEmployee:     "https://drive.google.com/file/d/17JdRu9sAM5nLCXdawFB7MHO_dh7hT0J-/preview",
  expenses:        "https://drive.google.com/file/d/1AYtmpnuaOe_5r5K7VVPvI1OGE8_TpM49/preview",
  inventory:       "https://drive.google.com/file/d/1D-vJ3JGPvgfuLcPMM8xaBMbLvz71d3zw/preview",
  newLeads:        "https://drive.google.com/file/d/1x7YTcjHKgFL9IL_OiAXpuEKbPuN9uLQd/preview",
  profile:         "https://drive.google.com/file/d/1imOf07uCJytbhaeL_TBC-DFIwDKg8KEn/preview",
  project:         "https://drive.google.com/file/d/1OM0H3clpJahRRPC97AnLKn0GTlUDZZxR/preview",
  reports:         "https://drive.google.com/file/d/108FxniflmezpKkVSyvjy6W981S8sm4Vd/preview",
  targetCustomers: "https://drive.google.com/file/d/1DnY8oY81uNZuydYTImCSqKuYAuCcymo4/preview",
  terms:           "https://drive.google.com/file/d/18Za-JEBXjvI5dmkWoRLh6rVZnD2kIGn3/preview",
  whatsappTemplate:"https://drive.google.com/file/d/1kWKr7X7UChUNlcZL0BfESsTXINmhNin6/preview",
} as const;

export type TutorialKey = keyof typeof TUTORIALS;