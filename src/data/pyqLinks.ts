/**
 * NIMCET Previous Year Questions (PYQ) Library Links
 * External PYQ Links — MyAspireStudy (16 resource links: 2011 to 2026)
 * Note: These provide links to external resources on MyAspireStudy. PrepPilot does not claim to have verified complete paper contents of external destination pages.
 */

export interface PYQPaperLink {
  year: number;
  url: string;
  provider: string;
  totalMarks?: number;
  totalQuestions?: number;
  durationMinutes?: number;
}

export const PYQ_PAPER_LINKS: PYQPaperLink[] = [
  {
    year: 2026,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2026',
    provider: 'MyAspireStudy',
  },
  {
    year: 2025,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2025',
    provider: 'MyAspireStudy',
  },
  {
    year: 2024,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2024',
    provider: 'MyAspireStudy',
  },
  {
    year: 2023,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2023',
    provider: 'MyAspireStudy',
  },
  {
    year: 2022,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2022',
    provider: 'MyAspireStudy',
  },
  {
    year: 2021,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2021',
    provider: 'MyAspireStudy',
  },
  {
    year: 2020,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2020',
    provider: 'MyAspireStudy',
  },
  {
    year: 2019,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2019',
    provider: 'MyAspireStudy',
  },
  {
    year: 2018,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2018',
    provider: 'MyAspireStudy',
  },
  {
    year: 2017,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2017',
    provider: 'MyAspireStudy',
  },
  {
    year: 2016,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2016',
    provider: 'MyAspireStudy',
  },
  {
    year: 2015,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2015',
    provider: 'MyAspireStudy',
  },
  {
    year: 2014,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2014',
    provider: 'MyAspireStudy',
  },
  {
    year: 2013,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2013',
    provider: 'MyAspireStudy',
  },
  {
    year: 2012,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2012',
    provider: 'MyAspireStudy',
  },
  {
    year: 2011,
    url: 'https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=2011',
    provider: 'MyAspireStudy',
  },
];

/**
 * Validates destination URL against the configured link list before opening
 */
export function isValidPYQUrl(targetUrl: string): boolean {
  return PYQ_PAPER_LINKS.some((p) => p.url === targetUrl);
}

/**
 * Retrieve paper link config by year
 */
export function getPYQPaperByYear(year: number): PYQPaperLink | undefined {
  return PYQ_PAPER_LINKS.find((p) => p.year === year);
}
