-- ============================================================
-- ParcIT — Script de création de la base de données
-- À copier-coller dans Supabase : SQL Editor > New query > Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Lieux ----------
create table lieux (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  type text default 'Officine',
  adresse text,
  created_at timestamptz default now()
);

-- ---------- Personnes ----------
create table personnes (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  fonction text,
  lieu_id uuid references lieux(id),
  contact text,
  created_at timestamptz default now()
);

-- ---------- Équipements ----------
create table equipements (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null,
  type text not null,
  marque text,
  modele text,
  numero_serie text,
  date_achat date,
  garantie_fin date,
  statut text not null default 'En stock'
    check (statut in ('En service','En stock','En panne','En reparation','Au rebut')),
  adresse_ip text,
  adresse_mac text,
  os text,
  note text,
  lieu_id uuid references lieux(id),
  utilisateur_id uuid references personnes(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Affectations (historique) ----------
create table affectations (
  id uuid primary key default uuid_generate_v4(),
  equipement_id uuid references equipements(id) not null,
  personne_id uuid references personnes(id),
  lieu_id uuid references lieux(id),
  date_affectation date not null default current_date,
  date_retour date,
  created_at timestamptz default now()
);

-- ---------- Maintenance ----------
create table maintenances (
  id uuid primary key default uuid_generate_v4(),
  equipement_id uuid references equipements(id) not null,
  probleme text not null,
  statut text not null default 'Ouvert'
    check (statut in ('Ouvert','En cours','Resolu')),
  date_declaration timestamptz default now(),
  date_resolution timestamptz,
  intervenant text,
  commentaire text
);

-- ---------- Consommables (suivi par quantité) ----------
create table consommables (
  id uuid primary key default uuid_generate_v4(),
  reference text unique not null,
  designation text not null,
  categorie text,
  stock_total int not null default 0,
  reserve int not null default 0,
  updated_at timestamptz default now()
);

-- ---------- Campagnes d'inventaire ----------
create table inventaire_campagnes (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  date_debut date default current_date,
  date_fin date,
  statut text default 'En cours'
);

create table inventaire_scans (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid references inventaire_campagnes(id) not null,
  equipement_id uuid references equipements(id) not null,
  trouve boolean default true,
  lieu_constate_id uuid references lieux(id),
  scanned_at timestamptz default now()
);

-- ---------- Journal des actions ----------
create table journal (
  id uuid primary key default uuid_generate_v4(),
  utilisateur text,
  action text not null,
  created_at timestamptz default now()
);

-- ---------- Table technique pour le mécanisme anti-pause ----------
create table keep_alive (
  id int primary key default 1,
  last_ping timestamptz default now()
);
insert into keep_alive (id, last_ping) values (1, now());

-- ============================================================
-- Sécurité : Row Level Security
-- Autorise uniquement les utilisateurs connectés (comptes de
-- l'équipe technique créés dans Supabase Authentication)
-- ============================================================
alter table lieux enable row level security;
alter table personnes enable row level security;
alter table equipements enable row level security;
alter table affectations enable row level security;
alter table maintenances enable row level security;
alter table consommables enable row level security;
alter table inventaire_campagnes enable row level security;
alter table inventaire_scans enable row level security;
alter table journal enable row level security;
alter table keep_alive enable row level security;

create policy "Lecture equipe connectee" on lieux for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on lieux for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on personnes for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on personnes for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on equipements for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on equipements for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on affectations for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on affectations for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on maintenances for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on maintenances for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on consommables for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on consommables for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on inventaire_campagnes for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on inventaire_campagnes for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on inventaire_scans for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on inventaire_scans for all using (auth.role() = 'authenticated');

create policy "Lecture equipe connectee" on journal for select using (auth.role() = 'authenticated');
create policy "Ecriture equipe connectee" on journal for all using (auth.role() = 'authenticated');

-- keep_alive : lisible/modifiable par n'importe qui (nécessaire pour le ping anti-pause, aucune donnée sensible)
create policy "Ping public" on keep_alive for select using (true);
create policy "Ping public update" on keep_alive for update using (true);

-- ============================================================
-- Données de démonstration (à supprimer si besoin depuis l'app)
-- ============================================================
insert into lieux (nom, type) values
  ('Entrepôt technique', 'Entrepôt'),
  ('Pharmacie du Marché', 'Officine'),
  ('Pharmacie des Lilas', 'Officine');

insert into personnes (nom, fonction, lieu_id)
  select 'Jean Dupont', 'Pharmacien', id from lieux where nom = 'Pharmacie du Marché';

insert into equipements (reference, type, marque, modele, numero_serie, date_achat, garantie_fin, statut, adresse_ip, adresse_mac, os, lieu_id, utilisateur_id)
  select 'PC-2026-00125','PC','Dell','OptiPlex 3090','ABC123456','2026-03-12','2029-03-12','En service',
         '192.168.1.25','3C:9A:1B:44:0F:E2','Windows 11 IoT',
         (select id from lieux where nom = 'Pharmacie du Marché'),
         (select id from personnes where nom = 'Jean Dupont');
