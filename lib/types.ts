export type Odbiorca = {
  id: number
  imie: string | null
  nazwisko: string | null
  ksywa: string | null
  tel: string | null
  miejsce_odbioru: string | null
  created_at: string
}

export type Folia = {
  id: number
  nazwa: string
  data_nalozenia: string | null
  pos_x: number
  pos_y: number
  szerokosc: number
  wysokosc: number
  kolor: string
  created_at: string
}

export type Nasiono = {
  id: number
  nazwa: string
}

export type Sianie = {
  id: number
  folia_id: number | null
  nasiona_id: number | null
  data: string
  uwagi: string | null
  created_at: string
  folie?: Folia
  nasiona?: Nasiono
}

export type Zbior = {
  id: number
  folia_id: number | null
  data_zbioru: string
  ilosc_klatek: number | null
  ilosc_w_klatce: number | null
  uwagi: string | null
  created_at: string
  folie?: Folia
}

export type Zamowienie = {
  id: number
  odbiorca_id: number | null
  data_na_kiedy: string | null
  data_utworzenia: string
  ilosc: number | null
  typ: string | null
  ilosc_w_klatce: number | null
  cena_za_peczek: number | null
  cena_calkowita: number | null
  wydane: boolean | null
  data_wydania: string | null
  puste_zwrocono: number | null
  zaplacono_kwota: number | null
  uwagi: string | null
  odbiorcy?: Odbiorca
}

export type Nawoz = {
  id: number
  nazwa: string
}

export type Nawozenie = {
  id: number
  folia_id: number | null
  data: string
  uwagi: string | null
  created_at: string
  folie?: Folia
  nawozenie_pozycje?: NawozenePozycja[]
}

export type NawozenePozycja = {
  id: number
  nawozenie_id: number
  nawoz_id: number | null
  ilosc: number | null
  jednostka: 'kg' | 'g' | null
  nawozy_slownik?: Nawoz
}

export type Oprysk = {
  id: number
  folia_id: number | null
  data: string
  preparat: string | null
  uwagi: string | null
  created_at: string
  folie?: Folia
}
