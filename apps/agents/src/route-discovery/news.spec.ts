import { classifyHeadline, reportsFromArticles } from './news.js';

describe('classifyHeadline', () => {
  it('drops sports results and diplomatic keyword hits', () => {
    expect(
      classifyHeadline(
        'China-EU talks in Beijing will seek to head off a trade conflict - Christian Science Monitor',
      ),
    ).toEqual([]);
    expect(
      classifyHeadline(
        'Maria Sakkari vs Storm Hunter · Round 2 · WTA Beijing - Tennis.com',
      ),
    ).toEqual([]);
    expect(
      classifyHeadline(
        'Double strike for Japan in Beijing as Matsushima and Odo beat Jha and Diaz - The Australian',
      ),
    ).toEqual([]);
    expect(
      classifyHeadline(
        'Long Island Rail Road strike is over, New York Gov. Hochul says',
      ),
    ).toEqual([]);
    expect(
      classifyHeadline(
        'United Airlines flight strike pole, truck during Newark Airport landing',
      ),
    ).toEqual([]);
    expect(classifyHeadline('Will Hurricane Isaias impact New York?')).toEqual(
      [],
    );
    expect(
      classifyHeadline(
        'Will Hurricane Isaias impact New York? What forecasters are saying',
      ),
    ).toEqual([]);
  });

  it('keeps a lane closure, a strike, and a weather event', () => {
    expect(
      classifyHeadline('Shanghai port closed after workers strike'),
    ).toEqual(['closure', 'strike']);
    expect(
      classifyHeadline('Flood pools to be built in Beijing after deadly storm'),
    ).toEqual(['storm']);
    expect(
      classifyHeadline('Beirut airport closed after a missile strike'),
    ).toEqual(['closure', 'strike', 'conflict']);
  });
});

describe('reportsFromArticles', () => {
  it('does not record a headline that only shares a hazard keyword', () => {
    expect(
      reportsFromArticles('google_news', 'origin', 'Beijing', [
        {
          title: 'Maria Sakkari vs Storm Hunter · Round 2 · WTA Beijing',
          url: 'https://news.google.com/articles/1',
          domain: 'https://www.tennis.com/story',
        },
      ]),
    ).toEqual([]);
    expect(
      reportsFromArticles('google_news', 'destination', 'New York', [
        {
          title:
            'What Travelers Need to Know as Hurricane Isaias Nears the Gulf Coast',
          url: 'https://www.nytimes.com/isaias',
          domain: 'nytimes.com',
        },
      ]),
    ).toEqual([]);
  });
});
