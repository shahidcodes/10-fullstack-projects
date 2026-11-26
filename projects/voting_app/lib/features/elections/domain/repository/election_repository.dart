import '../../data/models/election_model.dart';

abstract class ElectionRepository {
  Future<List<ElectionModel>> getElections();

  Future<ElectionModel> getElectionById(String electionId);
}
