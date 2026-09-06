import { absoluteUrl } from "@/lib/site-url";

type SeoPageStructuredDataProps = {
  title: string;
  description: string;
  path: string;
};

export function SeoPageStructuredData({ title, description, path }: SeoPageStructuredDataProps) {
  const pageUrl = absoluteUrl(path);
  const homeUrl = absoluteUrl("/");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        isPartOf: { "@id": `${homeUrl}#website` },
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Syncvas", item: homeUrl },
          { "@type": "ListItem", position: 2, name: title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
