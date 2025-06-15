import {baseUrl} from "@/lib/constants";

export default async function sitemap() {
  let routes = ["", "/top-artists", "/all-artists", "/world-map"].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split("T")[0],
  }));

  return [...routes];
}
