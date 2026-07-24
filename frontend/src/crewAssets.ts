// Resolves a crew member's portrait to an expo-image source.
// Local official portraits are bundled; future (admin-uploaded) portraits arrive as data URIs.
const LOCAL: Record<string, any> = {
  luigi: require("@/assets/images/crew/luigi.png"),
};

export function crewPortrait(member: any) {
  if (member?.portrait_key && LOCAL[member.portrait_key]) return LOCAL[member.portrait_key];
  if (member?.portrait) return { uri: member.portrait };
  return null;
}
