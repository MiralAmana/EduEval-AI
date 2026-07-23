import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import GeneralTab from "./tabs/GeneralTab";
import QuestionsTab from "./tabs/QuestionsTab";
import StatisticsTab from "./tabs/StatisticsTab";
import EvaluationAccessCard from "./EvaluationAccessCard";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getEvaluationById } from "@/services/evaluation.service";

const tabs = [
  {
    id: "general",
    label: "Général",
  },
  {
    id: "questions",
    label: "Questions",
  },
  {
    id: "statistics",
    label: "Statistiques",
  },
];

export default function EvaluationDetails() {
  const { id } = useParams();

  const [evaluation, setEvaluation] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState("general");

  useEffect(() => {
    loadEvaluation();
  }, [id]);

  async function loadEvaluation() {
    try {
      setLoading(true);
      setError("");

      const data = await getEvaluationById(id);

      setEvaluation(data);
    } catch (err) {
      setError(
        err.message ||
          "Impossible de charger cette évaluation."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto mt-10 max-w-xl p-8">
        <h2 className="text-xl font-bold text-red-600">
          Une erreur est survenue
        </h2>

        <p className="mt-4">{error}</p>

        <Button
          className="mt-6"
          onClick={loadEvaluation}
        >
          Réessayer
        </Button>
      </Card>
    );
  }

  if (!evaluation) {
    return null;
  }

  return (
    <div className="space-y-8">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold">
            {evaluation.title}
          </h1>

          <p className="mt-2 text-muted-foreground">
            {evaluation.description}
          </p>

        </div>

        <Link
          to={`/evaluations/${evaluation.id}/edit`}
        >
          <Button>
            Modifier
          </Button>
        </Link>

      </div>

      <EvaluationAccessCard
        evaluation={evaluation}
        onEvaluationChange={loadEvaluation}
      />

      {/* Navigation des onglets */}

      <div className="flex gap-3 border-b">

        {tabs.map((tab) => (

          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-2 transition

            ${
              activeTab === tab.id
                ? "border-b-2 border-primary font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>

        ))}

      </div>

      {/* Contenu */}

      {activeTab === "general" && (
        <GeneralTab
          evaluation={evaluation}
        />
      )}

      {activeTab === "questions" && (
        <QuestionsTab
          evaluation={evaluation}
        />
      )}

      {activeTab === "statistics" && (
        <StatisticsTab
          evaluation={evaluation}
        />
      )}

    </div>
  );
}