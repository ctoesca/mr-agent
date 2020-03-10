## Description

Ce document explique :
- le principe général des sauvegardes de bases de données postgres et oracle par CAPAM
- comment vérifier le paramétrage
- comment intégrer une sauvegarde de base dans un processus capam
- comment planifier une sauvegarde de base dans un agenda capam

## Principe général des sauvegardes
CAPAM est utilisé pour les sauvegardes des bases de données Postgres (simple ou en cluster) et oracle.

Les sauvegardes peuvent soit être planifiées dans un agenda, soit intégrées dans un processus (par exemple dans un processus de livraison).

Les paramètres des sauvegardes (pour savoir s'il faut faire un export et ou un backup d'une base) sont récupérés à partir des informations renseignées par GAD dans CTOP.

## Paramétrage dans CTOP

Ce paramétrage est fait par GAD. 
Si vous souhaitez le vérifier, il faut aller dans 

    Bdd -> Bdd relationnelles
	rechercher la base de données
	cliquer surle bouton de visualisation des données
	regarder l'onglet sauvegarde




# MR-agent

[![Build Status](https://travis-ci.org/ctoesca/mr-agent.svg?branch=master)](https://travis-ci.org/ctoesca/mr-agent)
[![Maintainability](https://api.codeclimate.com/v1/badges/a865589db2e1d75ca37f/maintainability)](https://codeclimate.com/github/ctoesca/mr-agent/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/a865589db2e1d75ca37f/test_coverage)](https://codeclimate.com/github/ctoesca/mr-agent/test_coverage)

MR-agent is a multi-roles, multi-platforms http/https agent.
