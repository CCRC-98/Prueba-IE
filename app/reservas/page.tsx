import ReservationPlanner from "@/components/reservation-planner";
import { stationsData } from "@/lib/stations";

export default function ReservationsExercisePage() {
  return <ReservationPlanner stations={stationsData} />;
}
