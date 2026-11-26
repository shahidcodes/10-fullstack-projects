import 'package:voting_app/features/elections/data/models/election_model.dart';
import 'package:voting_app/features/elections/data/services/election_services.dart';
import 'package:voting_app/features/elections/domain/repository/election_repository.dart';

class ElectionRepositoryImpl implements ElectionRepository {
  final ElectionService _electionService;

  ElectionRepositoryImpl({required this._electionService});

  @override
  Future<List<ElectionModel>> getElections() {
    return _electionService.getElections();
  }

  @override
  Future<ElectionModel> getElectionById(String electionId) {
    return _electionService.getElectionById(electionId);
  }
}
